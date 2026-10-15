"""文档分块、云端 Embedding 编码与 Qdrant 语义检索。"""
import json
import logging
import uuid

from sqlalchemy import insert, select, update

import config
import db
import embeddings
import qdrant_store

logger = logging.getLogger(__name__)


def split_text(text):
    """按字符数分块并保留重叠上下文，适用于中文和英文。"""
    chunk_size, overlap = config.CHUNK_SIZE, config.CHUNK_OVERLAP
    if chunk_size <= 0 or not 0 <= overlap < chunk_size:
        raise ValueError("分块配置必须满足 CHUNK_SIZE > 0 且 0 <= CHUNK_OVERLAP < CHUNK_SIZE")
    text = (text or "").strip()
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - overlap
    return chunks


def index_document(tenant_id, doc_id, kb_id, filename, content):
    """Write vectors first, then atomically persist preview chunks and their count."""
    chunks = split_text(content)
    if not chunks:
        return 0
    vectors = embeddings.embed_texts(chunks)
    timestamp = db.now()
    rows = [{
        "id": uuid.uuid4().hex, "tenant_id": tenant_id, "doc_id": doc_id,
        "kb_id": kb_id, "filename": filename, "chunk_index": index,
        "content": text, "created_at": timestamp,
    } for index, text in enumerate(chunks)]

    try:
        qdrant_store.upsert_chunks(rows, vectors)
        # SQL retains text for previews; vectors live only in Qdrant.
        with db.engine.begin() as connection:
            connection.execute(insert(db.Chunk), [
                {key: value for key, value in row.items() if key != "filename"}
                for row in rows
            ])
            result = connection.execute(
                update(db.Document).where(
                    db.Document.id == doc_id, db.Document.tenant_id == tenant_id,
                    db.Document.kb_id == kb_id,
                ).values(chunk_count=len(rows))
            )
            if result.rowcount != 1:
                raise RuntimeError("文档不存在或已被删除")
    except Exception:
        try:
            qdrant_store.delete_document(tenant_id, kb_id, doc_id)
        except Exception:
            # Preserve the indexing error; search also checks committed SQL chunks
            # so residual points from a failed compensation cannot be returned.
            logger.exception("清理 Qdrant 失败：tenant=%s kb=%s doc=%s", tenant_id, kb_id, doc_id)
        raise
    return len(rows)


def search(tenant_id, kb_id, query, top_k=None):
    """Retrieve from Qdrant with tenant/KB filters and verify committed SQL records."""
    query = (query or "").strip()
    if not query:
        return []
    if top_k is None:
        configured = db.query_one(select(db.TenantSetting.setting_value).where(
            db.TenantSetting.tenant_id == tenant_id, db.TenantSetting.setting_key == "top_k"
        ))
        try:
            top_k = int(json.loads(configured["setting_value"])) if configured else config.RETRIEVAL_TOP_K
        except (TypeError, ValueError):
            top_k = config.RETRIEVAL_TOP_K
    top_k = max(1, min(int(top_k), 20))
    if not db.query_one(select(db.Chunk.id).where(
        db.Chunk.tenant_id == tenant_id, db.Chunk.kb_id == kb_id
    ).limit(1)):
        return []

    vector = embeddings.embed_texts([query])[0]
    hits = qdrant_store.search(tenant_id, kb_id, vector, top_k)
    if not hits:
        return []
    ids = [uuid.UUID(str(hit.id)).hex for hit in hits]
    rows = db.query(
        select(db.Chunk.id, db.Chunk.content, db.Document.filename)
        .join(db.Document, db.Document.id == db.Chunk.doc_id)
        .where(db.Chunk.id.in_(ids), db.Chunk.tenant_id == tenant_id,
               db.Document.tenant_id == tenant_id, db.Chunk.kb_id == kb_id,
               db.Document.kb_id == kb_id, db.Document.chunk_count > 0)
    )
    committed = {row["id"]: row for row in rows}
    return [
        {"filename": committed[point_id]["filename"], "content": committed[point_id]["content"], "score": float(hit.score)}
        for point_id, hit in zip(ids, hits) if point_id in committed
    ]
