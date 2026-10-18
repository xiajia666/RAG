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


def ingest_document(tenant_id: str, kb_id: str, original_filename: str, data: bytes) -> dict:
    """Parse, persist, index and compensate storage on indexing failure."""
    filename = os.path.basename((original_filename or "unnamed").replace("\\", "/"))
    if not data:
        raise DocumentIngestionError("文件为空")
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
        document_repository.delete_document(tenant_id, doc_id)
        remove_original_file(tenant_id, doc_id, filename)
        raise DocumentIngestionError(f"向量化失败：{exc}", 500) from exc

    return {"document": document_repository.get_document(tenant_id, doc_id), "chunk_count": chunk_count}
