"""Document ingestion orchestration, independent of Flask request objects."""
import os
import uuid

from core import config
from rag import parsing
from rag import vector_store
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

    # 清除旧索引后重建
    vector_store.delete_document(tenant_id, doc_id)
    chunk_count = vector_store.index_document(tenant_id, doc_id, doc["kb_id"], doc["filename"], text)
    return {"document": document_repository.get_document(tenant_id, doc_id), "chunk_count": chunk_count}
