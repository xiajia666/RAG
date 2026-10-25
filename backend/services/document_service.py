"""Document ingestion orchestration, independent of Flask request objects."""
import json
import os
import uuid

from core import config
from rag import analysis, parsing, recommend, vector_store
from repositories import document_repository


class DocumentIngestionError(Exception):
    """Expected document processing failure with an HTTP-compatible status."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def original_path(tenant_id: str, doc_id: str, filename: str) -> str:
    tenant_dir = os.path.join(config.DOCUMENTS_DIR, tenant_id)
    os.makedirs(tenant_dir, exist_ok=True)
    return os.path.join(tenant_dir, f"{doc_id}_{filename}")


def remove_original_file(tenant_id: str, doc_id: str, filename: str) -> None:
    for path in (
        original_path(tenant_id, doc_id, filename),
        os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{filename}"),
    ):
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


def ingest_document(tenant_id: str, kb_id: str, original_filename: str, data: bytes,
                    parse_method: str = "plain") -> dict:
    """Parse, persist, index and compensate storage on indexing failure.

    parse_method:
      - "plain"  纯文本解析后分块索引（原有方式）；
      - "deepdoc" DeepDocs 深度解析，接口已预留、实现待开发（返回 501）；
      - "none"   仅保存原始文件，不解析、不建立索引。
    """
    filename = os.path.basename((original_filename or "unnamed").replace("\\", "/"))
    if not data:
        raise DocumentIngestionError("文件为空")

    parse_method = (parse_method or "plain").strip().lower()
    if parse_method == "deepdoc":
        # 接口已预留：DeepDocs 深度解析（版面分析 + OCR + 表格结构）实现待开发。
        raise DocumentIngestionError("DeepDocs 解析功能即将上线，暂未开放", 501)
    if parse_method not in ("plain", "none"):
        raise DocumentIngestionError("不支持的解析方式")

    # 仅上传不解析：只保存原始文件，不提取文本、不建立索引。
    if parse_method == "none":
        doc_id = uuid.uuid4().hex
        document_repository.create_document(tenant_id, kb_id, doc_id, filename, len(data))
        try:
            with open(original_path(tenant_id, doc_id, filename), "wb") as uploaded_file:
                uploaded_file.write(data)
        except Exception as exc:
            document_repository.delete_document(tenant_id, doc_id)
            raise DocumentIngestionError(f"保存文件失败：{exc}", 500) from exc
        return {"document": document_repository.get_document(tenant_id, doc_id), "chunk_count": 0}

    # 纯文本解析（原有方式）：解析 -> 分块 -> 向量入库。
    try:
        text = (parsing.extract_text(filename, data) or "").strip()
    except Exception as exc:
        raise DocumentIngestionError(f"解析文件失败：{exc}") from exc
    if not text:
        raise DocumentIngestionError("未能从文件中提取到文本（可能是扫描版 PDF）")

    doc_id = uuid.uuid4().hex
    document_repository.create_document(tenant_id, kb_id, doc_id, filename, len(data))
    try:
        with open(original_path(tenant_id, doc_id, filename), "wb") as uploaded_file:
            uploaded_file.write(data)
        chunk_count = vector_store.index_document(tenant_id, doc_id, kb_id, filename, text)
    except Exception as exc:
        try:
            vector_store.delete_document(tenant_id, doc_id)
        except Exception:
            pass
        document_repository.delete_document(tenant_id, doc_id)
        remove_original_file(tenant_id, doc_id, filename)
        raise DocumentIngestionError(f"向量化失败：{exc}", 500) from exc

    return {"document": document_repository.get_document(tenant_id, doc_id), "chunk_count": chunk_count}


def reparse_document(tenant_id: str, doc_id: str, parse_method: str = "plain") -> dict:
    """重新解析一份已上传文档（用于对「仅上传不解析」的文档补解析，或更换解析方式）。"""
    doc = document_repository.get_document(tenant_id, doc_id)
    if not doc:
        raise DocumentIngestionError("文档不存在", 404)

    parse_method = (parse_method or "plain").strip().lower()
    if parse_method == "deepdoc":
        raise DocumentIngestionError("DeepDocs 解析功能即将上线，暂未开放", 501)
    if parse_method != "plain":
        raise DocumentIngestionError("不支持的解析方式")

    # 读取原始文件（兼容新旧两套文件命名）
    path = next((candidate for candidate in (
        original_path(tenant_id, doc_id, doc["filename"]),
        os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{doc['filename']}"),
    ) if os.path.isfile(candidate)), None)
    if not path:
        raise DocumentIngestionError("原始文件不存在，无法解析", 404)
    with open(path, "rb") as uploaded_file:
        data = uploaded_file.read()

    # 先解析，失败时保留旧索引
    text = (parsing.extract_text(doc["filename"], data) or "").strip()
    if not text:
        raise DocumentIngestionError("未能从文件中提取到文本（可能是扫描版 PDF）")

    # 清除旧索引与旧分析缓存后重建
    document_repository.delete_analyses(tenant_id, doc_id)
    vector_store.delete_document(tenant_id, doc_id)
    chunk_count = vector_store.index_document(tenant_id, doc_id, doc["kb_id"], doc["filename"], text)
    return {"document": document_repository.get_document(tenant_id, doc_id), "chunk_count": chunk_count}


def _read_document(tenant_id: str, doc_id: str):
    """读取文档记录与原始文件字节，返回 (doc, data)。"""
    doc = document_repository.get_document(tenant_id, doc_id)
    if not doc:
        raise DocumentIngestionError("文档不存在", 404)

    path = next((candidate for candidate in (
        original_path(tenant_id, doc_id, doc["filename"]),
        os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{doc['filename']}"),
    ) if os.path.isfile(candidate)), None)
    if not path:
        raise DocumentIngestionError("原始文件不存在，无法分析", 404)
    with open(path, "rb") as uploaded_file:
        data = uploaded_file.read()
    return doc, data


def _extract_text(doc: dict, data: bytes) -> str:
    try:
        return (parsing.extract_text(doc["filename"], data) or "").strip()
    except Exception as exc:
        raise DocumentIngestionError(f"解析文件失败：{exc}") from exc


# 四类分析结果的分类键与对应计算函数。
_ANALYSIS_COMPUTE = {
    "document_size_index": analysis.compute_document_size_index,
    "structure_index": analysis.compute_structure_index,
    "content_type_index": analysis.compute_content_type_index,
}


def _cached_analysis(tenant_id: str, doc_id: str, category: str):
    """读取已缓存的分析结果；无缓存或解析失败时返回 None。"""
    raw = document_repository.get_analysis(tenant_id, doc_id, category)
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def _compute_analysis(tenant_id: str, doc_id: str, doc: dict, data: bytes, text: str, category: str) -> dict:
    """计算指标并写入缓存。"""
    result = _ANALYSIS_COMPUTE[category](doc["filename"], data, text)
    document_repository.save_analysis(tenant_id, doc_id, category, json.dumps(result, ensure_ascii=False))
    return result


def document_size_index_analyse(tenant_id: str, doc_id: str) -> dict:
    """读取「文档规模指标」，优先取缓存，无缓存时计算并写入。"""
    cached = _cached_analysis(tenant_id, doc_id, "document_size_index")
    if cached is not None:
        return cached
    doc, data = _read_document(tenant_id, doc_id)
    text = _extract_text(doc, data)
    return _compute_analysis(tenant_id, doc_id, doc, data, text, "document_size_index")


def structure_index_analyse(tenant_id: str, doc_id: str) -> dict:
    """读取「结构化程度指标」，优先取缓存，无缓存时计算并写入。"""
    cached = _cached_analysis(tenant_id, doc_id, "structure_index")
    if cached is not None:
        return cached
    doc, data = _read_document(tenant_id, doc_id)
    text = _extract_text(doc, data)
    return _compute_analysis(tenant_id, doc_id, doc, data, text, "structure_index")


def content_type_index_analyse(tenant_id: str, doc_id: str) -> dict:
    """读取「内容类型分布指标」，优先取缓存，无缓存时计算并写入。"""
    cached = _cached_analysis(tenant_id, doc_id, "content_type_index")
    if cached is not None:
        return cached
    doc, data = _read_document(tenant_id, doc_id)
    text = _extract_text(doc, data)
    return _compute_analysis(tenant_id, doc_id, doc, data, text, "content_type_index")


def chunking_recommend(tenant_id: str, doc_id: str) -> dict:
    """读取「AI 分块策略推荐」，优先取缓存；无缓存时调 LLM 生成并缓存（失败不缓存）。"""
    cached = _cached_analysis(tenant_id, doc_id, "chunking_recommend")
    if cached is not None:
        return cached
    doc, data = _read_document(tenant_id, doc_id)
    text = _extract_text(doc, data)
    result = recommend.recommend_chunking(doc, data, text)
    if isinstance(result, dict) and not result.get("error"):
        document_repository.save_analysis(
            tenant_id, doc_id, "chunking_recommend", json.dumps(result, ensure_ascii=False)
        )
    return result
