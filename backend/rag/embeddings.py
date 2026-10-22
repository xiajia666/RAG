"""云端 Embedding 客户端（OpenAI 兼容协议）。"""
import numpy as np
from openai import OpenAI

from core import config

_client = None


def get_client():
    global _client
    if _client is None:
        if not config.EMBEDDING_API_KEY:
            raise RuntimeError("EMBEDDING_API_KEY 未配置，请在 .env 中填写")
        _client = OpenAI(
            api_key=config.EMBEDDING_API_KEY,
            base_url=config.EMBEDDING_BASE_URL,
        )
    return _client


def embed_texts(texts):
    """批量编码文本，返回已归一化的 float32 数组，形状 (n, dim)。"""
    if not texts:
        return np.zeros((0, 0), dtype=np.float32)

    vectors = []
    batch = max(1, config.EMBEDDING_BATCH_SIZE)
    for i in range(0, len(texts), batch):
        resp = get_client().embeddings.create(
            model=config.EMBEDDING_MODEL,
            input=list(texts[i:i + batch]),
        )
        # 部分兼容服务返回顺序不保证与 input 一致，按 index 排序
        items = sorted(resp.data, key=lambda d: d.index)
        expected_count = len(texts[i:i + batch])
        if [item.index for item in items] != list(range(expected_count)):
            raise ValueError("Embedding 服务返回的向量数量或索引与输入不匹配")
        vectors.extend([it.embedding for it in items])

    arr = np.asarray(vectors, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[0] != len(texts) or arr.shape[1] == 0 or not np.isfinite(arr).all():
        raise ValueError("Embedding 服务返回了无效向量")
    # 归一化后余弦相似度等价于点积
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    if not np.isfinite(norms).all() or (norms == 0).any():
        raise ValueError("Embedding 服务返回了零向量或无效向量")
    return arr / norms
