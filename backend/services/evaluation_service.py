"""文档测试集生成编排（读取整篇文档文本 -> ragas 生成问题/答案）。"""
from __future__ import annotations

import typing as t

from services import document_service


class TestsetGenerationError(Exception):
    """测试集生成失败（携带 HTTP 兼容状态码）。"""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _load_ragas():
    # 延迟导入：ragas 依赖较重，只有真正调用评测接口时才加载，
    # 避免未安装/版本不匹配时影响应用启动。
    try:
        from rag.rag_evaluation import generate_testset
    except Exception as exc:  # pragma: no cover - 取决于运行环境
        raise TestsetGenerationError(
            f"ragas 不可用，请确认已按 requirements.txt 安装依赖：{exc}", 500
        ) from exc
    return generate_testset


def generate_document_testset(
    tenant_id: str,
    documents: t.List[dict],
    test_size: int,
    distributions: t.Optional[t.Dict[str, float]] = None,
) -> dict:
    """读取多份文档的整篇文本并生成测试集。

    Args:
        tenant_id: 租户 id。
        documents: 已通过权限校验的文档记录列表（至少包含 id / filename）。
        test_size: 期望生成的问题数量。
        distributions: 可选的问题类型比例。
    """
    if not documents:
        raise TestsetGenerationError("请先选择文档")

    entries = []
    for doc in documents:
        try:
            full = document_service.get_document_full_text(tenant_id, doc["id"])
        except document_service.DocumentIngestionError as exc:
            raise TestsetGenerationError(f"《{doc.get('filename', '')}》读取失败：{exc}", exc.status_code) from exc
        entries.append({"filename": doc.get("filename", ""), "text": full["text"]})

    try:
        return _load_ragas()(
            documents=entries,
            test_size=test_size,
            distributions=distributions,
        )
    except TestsetGenerationError:
        raise
    except ValueError as exc:
        raise TestsetGenerationError(str(exc), 400) from exc
    except Exception as exc:
        raise TestsetGenerationError(f"测试集生成失败：{exc}", 500) from exc
