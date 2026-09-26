"""向量切分与检索：云端 Embedding + 余弦相似度。"""
import json
import uuid

import numpy as np

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
        rows.append((
            uuid.uuid4().hex,
            tenant_id,
            doc_id,
            kb_id,
            i,
            chunk_text,
            vec.astype(np.float32).tobytes(),
            now,
        ))

    db.executemany(
        "INSERT INTO chunks (id, tenant_id, doc_id, kb_id, chunk_index, content, embedding, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    db.execute("UPDATE documents SET chunk_count = ? WHERE id = ? AND tenant_id = ?", (len(rows), doc_id, tenant_id))
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
        configured = db.query_one(
            "SELECT setting_value FROM tenant_settings WHERE tenant_id = ? AND setting_key = 'top_k'",
            (tenant_id,),
        )
        try:
            top_k = int(json.loads(configured["setting_value"])) if configured else config.RETRIEVAL_TOP_K
        except (TypeError, ValueError):
            top_k = config.RETRIEVAL_TOP_K

    rows = db.query(
        "SELECT c.content AS content, c.embedding AS embedding, d.filename AS filename "
        "FROM chunks c JOIN documents d ON d.id = c.doc_id "
        "WHERE c.tenant_id = ? AND d.tenant_id = ? AND c.kb_id = ?",
        (tenant_id, tenant_id, kb_id),
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
