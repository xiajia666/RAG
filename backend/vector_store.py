"""向量切分与检索：云端 Embedding + 余弦相似度。"""
import json
import uuid

import numpy as np
from sqlalchemy import insert, select, update

import config
import db
import embeddings


def split_text(text):
    """按固定大小 + 重叠对文本分块。"""
    if not text:
        return []
    text = text.strip()
    if not text:
        return []

    chunk_size = config.CHUNK_SIZE
    overlap = config.CHUNK_OVERLAP

    chunks = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        if end >= n:
            break

        # 防止 overlap >= chunk_size 时死循环
        next_start = end - overlap
        if next_start <= start:
            next_start = end
        start = next_start

    return chunks


def index_document(tenant_id, doc_id, kb_id, filename, content):
    """分块 -> 编码 -> 写入 chunks 表。返回 chunk 数量。"""
    chunks = split_text(content)
    if not chunks:
        return 0

    vectors = embeddings.embed_texts(chunks)
    now = db.now()
    rows = []
    for i, (chunk_text, vec) in enumerate(zip(chunks, vectors)):
        rows.append({
            "id": uuid.uuid4().hex,
            "tenant_id": tenant_id,
            "doc_id": doc_id,
            "kb_id": kb_id,
            "chunk_index": i,
            "content": chunk_text,
            "embedding": vec.astype(np.float32).tobytes(),
            "created_at": now,
        })

    db.executemany(insert(db.Chunk), rows)
    db.execute(
        update(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == tenant_id)
        .values(chunk_count=len(rows))
    )
    return len(rows)


def search(tenant_id, kb_id, query, top_k=None):
    """在指定知识库内检索与 query 最相似的 chunk。

    返回：
    [
        {"filename": "...", "content": "...", "score": 0.85},
        ...
    ]
    """
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

    rows = db.query(
        select(db.Chunk.content, db.Chunk.embedding, db.Document.filename)
        .join(db.Document, db.Document.id == db.Chunk.doc_id)
        .where(db.Chunk.tenant_id == tenant_id, db.Document.tenant_id == tenant_id, db.Chunk.kb_id == kb_id)
    )
    rows = [r for r in rows if r.get("embedding")]
    if not rows:
        return []

    query_vec = embeddings.embed_texts([query])[0]
    vectors = [np.frombuffer(r["embedding"], dtype=np.float32) for r in rows]
    matrix = np.stack(vectors)

    scores = matrix @ query_vec
    indices = np.argsort(-scores)[:top_k]

    results = []
    for idx in indices:
        i = int(idx)
        results.append({
            "filename": rows[i]["filename"],
            "content": rows[i]["content"],
            "score": float(scores[i]),
        })
    return results
