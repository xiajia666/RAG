"""Chunk indexing and semantic search backed by Elasticsearch dense vectors."""
import json
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from sqlalchemy import select, update

from core import config, db
from rag import embeddings

_client = None


def _get_client():
    global _client
    if _client is None:
        options = {"hosts": [config.ELASTICSEARCH_URL], "verify_certs": config.ELASTICSEARCH_VERIFY_CERTS}
        if config.ELASTICSEARCH_API_KEY:
            options["api_key"] = config.ELASTICSEARCH_API_KEY
        elif config.ELASTICSEARCH_USERNAME:
            options["basic_auth"] = (config.ELASTICSEARCH_USERNAME, config.ELASTICSEARCH_PASSWORD)
        _client = Elasticsearch(**options)
    return _client


def _ensure_index(vector_size):
    client = _get_client()
    if client.indices.exists(index=config.ELASTICSEARCH_INDEX):
        mapping = client.indices.get_mapping(index=config.ELASTICSEARCH_INDEX)
        properties = mapping[config.ELASTICSEARCH_INDEX]["mappings"].get("properties", {})
        vector_mapping = properties.get("embedding", {}).get("dims")
        if vector_mapping is not None and vector_mapping != vector_size:
            raise RuntimeError(
                f"Elasticsearch 索引向量维度为 {vector_mapping}，当前模型输出 {vector_size}；"
                "请为新模型配置新的 ELASTICSEARCH_INDEX 并重新导入文档"
            )
        return

    client.indices.create(
        index=config.ELASTICSEARCH_INDEX,
        mappings={"properties": {
            "tenant_id": {"type": "keyword"},
            "kb_id": {"type": "keyword"},
            "doc_id": {"type": "keyword"},
            "filename": {"type": "keyword"},
            "chunk_index": {"type": "integer"},
            "content": {"type": "text", "index": False},
            "embedding": {"type": "dense_vector", "dims": vector_size, "index": True, "similarity": "cosine"},
            "created_at": {"type": "date", "format": "yyyy-MM-dd HH:mm:ss||strict_date_optional_time"},
        }},
    )


def _index_chunks(records, refresh="wait_for"):
    records = list(records)
    if not records:
        return 0
    _ensure_index(len(records[0]["embedding"]))
    actions = ({
        "_index": config.ELASTICSEARCH_INDEX,
        "_id": record["id"],
        "_source": record,
    } for record in records)
    success, errors = bulk(_get_client(), actions, refresh=refresh, raise_on_error=False)
    if errors:
        raise RuntimeError(f"Elasticsearch 写入失败：{errors[0]}")
    return success


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
        next_start = end - overlap
        start = next_start if next_start > start else end
    return chunks


def index_document(tenant_id, doc_id, kb_id, filename, content):
    """分块、编码并将文本和向量写入 Elasticsearch。"""
    chunks = split_text(content)
    if not chunks:
        return 0

    vectors = embeddings.embed_texts(chunks)
    created_at = db.now()
    records = [{
        "id": f"{doc_id}-{i}",
        "tenant_id": tenant_id,
        "doc_id": doc_id,
        "kb_id": kb_id,
        "filename": filename,
        "chunk_index": i,
        "content": chunk_text,
        "embedding": vec.tolist(),
        "created_at": created_at,
    } for i, (chunk_text, vec) in enumerate(zip(chunks, vectors))]
    _index_chunks(records)
    db.execute(
        update(db.Document).where(db.Document.id == doc_id, db.Document.tenant_id == tenant_id)
        .values(chunk_count=len(records))
    )
    return len(records)


def search(tenant_id, kb_id, query, top_k=None):
    """在 Elasticsearch 中进行租户与知识库隔离的 kNN 检索。"""
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
    top_k = max(1, min(int(top_k), 100))

    try:
        if not _get_client().indices.exists(index=config.ELASTICSEARCH_INDEX):
            return []
        query_vector = embeddings.embed_texts([query])[0].tolist()
        _ensure_index(len(query_vector))
        response = _get_client().search(
            index=config.ELASTICSEARCH_INDEX,
            knn={
                "field": "embedding",
                "query_vector": query_vector,
                "k": top_k,
                "num_candidates": max(top_k * 10, 100),
                "filter": {"bool": {"filter": [
                    {"term": {"tenant_id": tenant_id}},
                    {"term": {"kb_id": kb_id}},
                ]}},
            },
            source=["filename", "content"],
        )
        return [{
            "filename": hit["_source"]["filename"],
            "content": hit["_source"]["content"],
            "score": float(hit["_score"]),
        } for hit in response["hits"]["hits"]]
    except Exception:
        # Elasticsearch / Embedding 连接异常时降级为空结果，避免中断对话流。
        return []


def get_document_chunks(tenant_id, doc_id, limit=5):
    """Fetch a small ordered chunk preview from Elasticsearch."""
    try:
        if not _get_client().indices.exists(index=config.ELASTICSEARCH_INDEX):
            return []
        response = _get_client().search(
            index=config.ELASTICSEARCH_INDEX,
            query={"bool": {"filter": [
                {"term": {"tenant_id": tenant_id}},
                {"term": {"doc_id": doc_id}},
            ]}},
            size=limit,
            sort=[{"chunk_index": "asc"}],
            source=["chunk_index", "content", "created_at"],
        )
        return [hit["_source"] for hit in response["hits"]["hits"]]
    except Exception:
        return []


def delete_document(tenant_id, doc_id):
    """Remove all Elasticsearch chunks belonging to one tenant document."""
    try:
        if not _get_client().indices.exists(index=config.ELASTICSEARCH_INDEX):
            return
        _get_client().delete_by_query(
            index=config.ELASTICSEARCH_INDEX,
            query={"bool": {"filter": [
                {"term": {"tenant_id": tenant_id}},
                {"term": {"doc_id": doc_id}},
            ]}},
            refresh=True,
            conflicts="proceed",
        )
    except Exception:
        pass


def delete_knowledge_base(tenant_id, kb_id):
    """Remove all Elasticsearch chunks belonging to one tenant knowledge base."""
    try:
        if not _get_client().indices.exists(index=config.ELASTICSEARCH_INDEX):
            return
        _get_client().delete_by_query(
            index=config.ELASTICSEARCH_INDEX,
            query={"bool": {"filter": [
                {"term": {"tenant_id": tenant_id}},
                {"term": {"kb_id": kb_id}},
            ]}},
            refresh=True,
            conflicts="proceed",
        )
    except Exception:
        pass
