"""Document persistence operations."""
from sqlalchemy import delete, insert, select

from core import db
from models import DocumentAnalysis


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


def get_analysis(tenant_id: str, doc_id: str, category: str) -> str | None:
    row = db.query_one(
        select(DocumentAnalysis.data).where(
            DocumentAnalysis.tenant_id == tenant_id,
            DocumentAnalysis.doc_id == doc_id,
            DocumentAnalysis.category == category,
        )
    )
    return row["data"] if row else None


def save_analysis(tenant_id: str, doc_id: str, category: str, data_json: str) -> None:
    # 简单 upsert：先删后插。分析缓存非关键路径，重复写结果一致即可。
    db.execute(delete(DocumentAnalysis).where(
        DocumentAnalysis.tenant_id == tenant_id,
        DocumentAnalysis.doc_id == doc_id,
        DocumentAnalysis.category == category,
    ))
    db.execute(insert(DocumentAnalysis).values(
        tenant_id=tenant_id, doc_id=doc_id, category=category,
        data=data_json, created_at=db.now(),
    ))


def delete_analyses(tenant_id: str, doc_id: str) -> None:
    db.execute(delete(DocumentAnalysis).where(
        DocumentAnalysis.tenant_id == tenant_id,
        DocumentAnalysis.doc_id == doc_id,
    ))
