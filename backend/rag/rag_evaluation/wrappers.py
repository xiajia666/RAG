"""ragas 的 LLM / Embedding 适配器。

ragas 0.1.12 的 TestsetGenerator 通过 ``BaseRagasLLM`` 与 ``BaseRagasEmbeddings``
抽象接口调用模型。这里复用项目已有的 DeepSeek 问答客户端与云端 Embedding 客户端，
避免引入 langchain-openai 在非 OpenAI 服务上的兼容问题（例如 OpenAI 兼容端点不接受
token id 数组作为 embedding 输入）。
"""
from __future__ import annotations

import asyncio
import typing as t

from langchain_core.outputs import Generation, LLMResult
from ragas.embeddings.base import BaseRagasEmbeddings
from ragas.llms.base import BaseRagasLLM
from ragas.run_config import RunConfig

from rag import embeddings, llm


class DeepSeekRagasLLM(BaseRagasLLM):
    """基于项目 DeepSeek 客户端的 ragas LLM 适配器。"""

    def __init__(self, run_config: t.Optional[RunConfig] = None) -> None:
        self.run_config = run_config or RunConfig()

    def _call(self, prompt_text: str, temperature: float, n: int) -> LLMResult:
        temperature = max(1e-8, temperature or 0.3)
        generations = []
        for _ in range(n):
            text = llm.chat(
                [{"role": "user", "content": prompt_text}],
                temperature=temperature,
                max_tokens=2048,
            )
            generations.append(Generation(text=text))
        return LLMResult(generations=[generations])

    def generate_text(
        self,
        prompt: t.Any,
        n: int = 1,
        temperature: float = 1e-8,
        stop: t.Optional[t.List[str]] = None,
        callbacks: t.Any = None,
    ) -> LLMResult:
        return self._call(prompt.to_string(), temperature, n)

    async def agenerate_text(
        self,
        prompt: t.Any,
        n: int = 1,
        temperature: t.Optional[float] = None,
        stop: t.Optional[t.List[str]] = None,
        callbacks: t.Any = None,
    ) -> LLMResult:
        # DeepSeek 客户端为同步实现，放入线程池避免阻塞事件循环。
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self._call, prompt.to_string(), temperature or 0.3, n
        )


class CloudRagasEmbeddings(BaseRagasEmbeddings):
    """基于项目云端 Embedding 客户端的 ragas Embedding 适配器。"""

    def __init__(self, run_config: t.Optional[RunConfig] = None) -> None:
        self.run_config = run_config or RunConfig()

    def embed_documents(self, texts: t.List[str]) -> t.List[t.List[float]]:
        if not texts:
            return []
        return embeddings.embed_texts(texts).tolist()

    def embed_query(self, text: str) -> t.List[float]:
        return self.embed_documents([text])[0]

    async def aembed_documents(self, texts: t.List[str]) -> t.List[t.List[float]]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.embed_documents, texts)

    async def aembed_query(self, text: str) -> t.List[float]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self.embed_query, text)
