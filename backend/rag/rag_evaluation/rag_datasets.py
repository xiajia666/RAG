"""基于 Ragas 内置 Query Synthesizer 生成问答测试集。

当前支持三种 Ragas 内置问题类型和一种自定义问题类型：

* ``single_hop_specific``：单跳具体
* ``multi_hop_specific``：多跳具体
* ``multi_hop_abstract``：多跳抽象
* ``unanswerable``：不可回答（自定义 Query Synthesizer）

``distributions`` 中的值可以传数量或权重，生成前会统一归一化。
接口可以提前传入全部十种业务问题类型；尚未实现的六种类型会暂时忽略。
"""
from __future__ import annotations

import typing as t

from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from ragas.run_config import RunConfig
from ragas.testset import TestsetGenerator

from rag.rag_evaluation.evaluation_type import (
    QUESTION_TYPE_LABELS,
    build_query_distribution,
)
from rag.rag_evaluation.wrappers import CloudRagasEmbeddings, DeepSeekRagasLLM


def _build_chunks(documents: t.List[t.Dict[str, str]]) -> t.List[Document]:
    """切分文档并保留来源信息，供 Ragas 构建知识图谱。"""
    splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
    chunks: t.List[Document] = []
    for document in documents:
        metadata = {
            "filename": document.get("filename", ""),
            "doc_id": document.get("doc_id", ""),
        }
        chunks.extend(
            Document(page_content=text, metadata=dict(metadata))
            for text in splitter.split_text(document["text"])
            if text.strip()
        )
    return chunks


def generate_testset(
    documents: t.List[t.Dict[str, str]],
    test_size: int = 10,
    distributions: t.Optional[t.Dict[str, float]] = None,
) -> t.Dict[str, t.Any]:
    """根据整篇文档文本生成测试集。

    Args:
        documents: ``[{"filename": str, "text": str}, ...]``。
        test_size: 期望生成的问题数量。
        distributions: 十种业务问题类型的数量或权重；当前只使用四个已支持类型。
    """
    documents = [document for document in documents if document.get("text", "").strip()]
    if not documents:
        raise ValueError("没有可用的文档文本")

    test_size = max(1, int(test_size))
    run_config = RunConfig(timeout=1200, max_retries=5, max_wait=60, max_workers=4)
    llm = DeepSeekRagasLLM(run_config=run_config)
    embeddings = CloudRagasEmbeddings(run_config=run_config)
    query_distribution = build_query_distribution(llm, distributions)
    chunks = _build_chunks(documents)
    if not chunks:
        raise ValueError("文档切分后没有可用节点，无法生成测试集")

    generator = TestsetGenerator(llm=llm, embedding_model=embeddings)
    testset = generator.generate_with_chunks(
        chunks=chunks,
        testset_size=test_size,
        query_distribution=query_distribution,
        run_config=run_config,
        raise_exceptions=True,
    )

    testset_rows = []
    for row in testset.to_list():
        question_type = str(row.get("synthesizer_name", ""))
        answer = row.get("reference")
        testset_rows.append(
            {
                "question": str(row.get("user_input") or "").strip(),
                "answer": str(answer or "").strip(),
                "question_type": question_type,
                "question_type_label": QUESTION_TYPE_LABELS.get(question_type, ""),
                "contexts": list(row.get("reference_contexts") or []),
            }
        )

    return {
        "total": len(testset_rows),
        "testset": testset_rows,
        "question_type_ratio": _compute_ratio(testset_rows),
    }


def _compute_ratio(
    testset_rows: t.List[t.Dict[str, t.Any]],
) -> t.Dict[str, t.Dict[str, t.Any]]:
    counts: t.Dict[str, int] = {}
    for row in testset_rows:
        counts[row["question_type"]] = counts.get(row["question_type"], 0) + 1

    total = len(testset_rows) or 1
    return {
        question_type: {
            "count": count,
            "ratio": round(count / total, 4),
            "label": QUESTION_TYPE_LABELS.get(question_type, ""),
        }
        for question_type, count in sorted(counts.items(), key=lambda item: -item[1])
    }
