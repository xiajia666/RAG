"""Document persistence operations."""
from sqlalchemy import delete, insert, select

from core import db


def create_document(tenant_id: str, kb_id: str, doc_id: str, filename: str, size: int) -> None:
    db.execute(insert(db.Document).values(
        id=doc_id, tenant_id=tenant_id, kb_id=kb_id, filename=filename,
        size=size, chunk_count=0, created_at=db.now(),
    ))


def get_document(tenant_id: str, doc_id: str) -> dict | None:
    return db.query_one(select(db.Document).where(
        db.Document.id == doc_id, db.Document.tenant_id == tenant_id,
    ))


def delete_document(tenant_id: str, doc_id: str) -> None:
    db.execute(delete(db.Document).where(
        db.Document.id == doc_id, db.Document.tenant_id == tenant_id,
    ))
