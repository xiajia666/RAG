"""基于 ragas 从整篇文档生成测试集（问题 / 答案 / 问题类型 / 类型比例）。

用法：
    from rag.rag_evaluation import generate_testset
    result = generate_testset(
        documents=[{"filename": "a.pdf", "text": "……整篇文档文本……"}],
        test_size=10,
    )

``result`` 结构：
    {
        "total": 10,
        "testset": [
            {"question": "...", "answer": "...", "question_type": "simple",
             "question_type_label": "单跳问题", "contexts": ["..."]},
            ...
        ],
        "question_type_ratio": {
            "simple": {"count": 5, "ratio": 0.5, "label": "单跳问题"},
            ...
        },
    }
"""
from __future__ import annotations

import typing as t

import numpy as np
from langchain.text_splitter import RecursiveCharacterTextSplitter
from ragas.run_config import RunConfig
from ragas.testset import TestsetGenerator
from ragas.testset.docstore import Document, InMemoryDocumentStore
from ragas.testset.evolutions import (
    conditional,
    multi_context,
    reasoning,
    simple,
)
from ragas.testset.extractor import KeyphraseExtractor

from rag.rag_evaluation.wrappers import CloudRagasEmbeddings, DeepSeekRagasLLM

# ragas 的 evolution_type 与业务中文名映射。
QUESTION_TYPE_LABELS = {
    "simple": "单跳问题",
    "reasoning": "多跳推理",
    "multi_context": "多上下文",
    "conditional": "条件问题",
}

_EVOLUTION_BY_TYPE = {
    "simple": simple,
    "reasoning": reasoning,
    "multi_context": multi_context,
    "conditional": conditional,
}

# 默认的问题类型比例（与 ragas 默认一致）。
DEFAULT_DISTRIBUTIONS = {
    "simple": 0.5,
    "reasoning": 0.25,
    "multi_context": 0.25,
}


def _normalise_distributions(
    distributions: t.Optional[t.Dict[str, float]],
) -> t.Dict[t.Any, float]:
    raw = dict(distributions or DEFAULT_DISTRIBUTIONS)
    if not raw:
        raw = dict(DEFAULT_DISTRIBUTIONS)

    unknown = set(raw) - set(_EVOLUTION_BY_TYPE)
    if unknown:
        raise ValueError(f"不支持的问题类型：{sorted(unknown)}")

    total = sum(float(v) for v in raw.values())
    if total <= 0:
        raise ValueError("问题类型比例之和必须大于 0")
    return {_EVOLUTION_BY_TYPE[name]: float(weight) / total for name, weight in raw.items()}


def _build_docstore(
    llm: DeepSeekRagasLLM,
    embeddings: CloudRagasEmbeddings,
    run_config: RunConfig,
):
    # 按字符粒度切分整篇文档（中文按字符、英文按词/分隔符递归切分）。
    # 更细的节点能支撑 ragas 的 multi_context / reasoning 等多节点演化。
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    extractor = KeyphraseExtractor(llm=llm)
    return InMemoryDocumentStore(
        splitter=splitter,
        embeddings=embeddings,
        extractor=extractor,
        run_config=run_config,
    )


def generate_testset(
    documents: t.List[t.Dict[str, str]],
    test_size: int = 10,
    distributions: t.Optional[t.Dict[str, float]] = None,
) -> t.Dict[str, t.Any]:
    """根据整篇文档文本生成测试集。

    Args:
        documents: ``[{"filename": str, "text": str}, ...]``，``text`` 为整篇文档文本。
        test_size: 期望生成的问题数量。
        distributions: 可选的问题类型比例，例如 ``{"simple": 0.5, "reasoning": 0.25,
            "multi_context": 0.25}``；缺省使用默认比例。
    """
    documents = [d for d in documents if d.get("text", "").strip()]
    if not documents:
        raise ValueError("没有可用的文档文本")

    test_size = max(1, int(test_size))
    evolution_distributions = _normalise_distributions(distributions)

    run_config = RunConfig(timeout=120, max_retries=5, max_wait=60, max_workers=4)
    llm = DeepSeekRagasLLM(run_config=run_config)
    embeddings = CloudRagasEmbeddings(run_config=run_config)
    docstore = _build_docstore(llm, embeddings, run_config)

    ragas_docs = [
        Document(
            page_content=d["text"],
            metadata={"filename": d.get("filename", ""), "doc_id": d.get("doc_id", "")},
        )
        for d in documents
    ]
    docstore.add_documents(ragas_docs)

    # 生成的问题数不能超过可用的节点数，否则抽样会越界。
    node_count = len(docstore.nodes)
    if node_count == 0:
        raise ValueError("文档切分后没有可用节点，无法生成测试集")
    test_size = min(test_size, node_count)

    generator = TestsetGenerator(
        generator_llm=llm,
        critic_llm=llm,
        embeddings=embeddings,
        docstore=docstore,
    )
    testset = generator.generate(
        test_size=test_size,
        distributions=evolution_distributions,
        is_async=False,
        raise_exceptions=True,
        run_config=run_config,
    )

    df = testset.to_pandas()
    testset_rows = []
    for _, row in df.iterrows():
        answer = row.get("ground_truth", np.nan)
        if answer is None or (isinstance(answer, float) and np.isnan(answer)):
            answer = ""
        testset_rows.append({
            "question": str(row.get("question", "")).strip(),
            "answer": str(answer).strip(),
            "question_type": row.get("evolution_type", ""),
            "question_type_label": QUESTION_TYPE_LABELS.get(row.get("evolution_type", ""), ""),
            "contexts": list(row.get("contexts", []) or []),
        })

    ratio = _compute_ratio(testset_rows)
    return {
        "total": len(testset_rows),
        "testset": testset_rows,
        "question_type_ratio": ratio,
    }


def _compute_ratio(testset_rows: t.List[t.Dict[str, t.Any]]) -> t.Dict[str, t.Dict[str, t.Any]]:
    counts: t.Dict[str, int] = {}
    for row in testset_rows:
        counts[row["question_type"]] = counts.get(row["question_type"], 0) + 1

    total = len(testset_rows) or 1
    return {
        qtype: {
            "count": count,
            "ratio": round(count / total, 4),
            "label": QUESTION_TYPE_LABELS.get(qtype, ""),
        }
        for qtype, count in sorted(counts.items(), key=lambda item: -item[1])
    }
