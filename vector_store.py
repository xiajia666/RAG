"""向量切分与检索：TF-IDF 字符 n-gram 向量 + 余弦相似度。

说明：这里用的是轻量级 TF-IDF 向量（无需额外 API key 或下载模型）。
检索时对「全部已入库的 chunk」统一 fit，保证所有 chunk 处于同一向量空间，
从而可以正确计算相似度。
"""
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

import config
import storage


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


def _make_vectorizer():
    return TfidfVectorizer(
        analyzer="char",
        ngram_range=(2, 4),
        min_df=1,
        max_df=1.0,
    )


def index_document(doc_id, filename, content):
    """分块 -> 存入 DocStore。返回 chunk 数量。"""
    chunks = split_text(content)
    if not chunks:
        return 0
    return storage.add_chunks(doc_id, filename, chunks)


def search(query, top_k=None):
    """根据 query 检索最相似的文本 chunk。

    返回：
    [
        {"filename": "...", "content": "...", "score": 0.85},
        ...
    ]
    """
    query = (query or "").strip()
    if not query:
        return []

    chunks = storage.get_all_chunks()
    if not chunks:
        return []

    top_k = top_k or config.RETRIEVAL_TOP_K

    texts = [c["content"] for c in chunks]
    vec = _make_vectorizer()
    matrix = vec.fit_transform(texts)
    query_vec = vec.transform([query])

    similarities = cosine_similarity(query_vec, matrix)[0]
    # 相似度从高到低排序的索引
    indices = similarities.argsort()[::-1]

    results = []
    for idx in indices[:top_k]:
        score = float(similarities[idx])
        c = chunks[idx]
        results.append({
            "filename": c["filename"],
            "content": c["content"],
            "score": score,
        })

    return results
