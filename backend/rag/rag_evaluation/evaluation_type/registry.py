"""问题类型注册、参数过滤与 Synthesizer 分布构建。"""
from __future__ import annotations

import typing as t

from .base import EvaluationTypeDefinition
from .comparative import EVALUATION_TYPE as COMPARATIVE
from .conditional_constraint import EVALUATION_TYPE as CONDITIONAL_CONSTRAINT
from .conditional_reasoning import EVALUATION_TYPE as CONDITIONAL_REASONING
from .cross_document import EVALUATION_TYPE as CROSS_DOCUMENT
from .factual import EVALUATION_TYPE as FACTUAL
from .multi_hop_abstract import EVALUATION_TYPE as MULTI_HOP_ABSTRACT
from .multi_hop_specific import EVALUATION_TYPE as MULTI_HOP_SPECIFIC
from .single_hop_abstract import EVALUATION_TYPE as SINGLE_HOP_ABSTRACT
from .single_hop_specific import EVALUATION_TYPE as SINGLE_HOP_SPECIFIC
from .unanswerable import EVALUATION_TYPE as UNANSWERABLE


EVALUATION_TYPES: t.Tuple[EvaluationTypeDefinition, ...] = (
    SINGLE_HOP_SPECIFIC,
    SINGLE_HOP_ABSTRACT,
    MULTI_HOP_SPECIFIC,
    MULTI_HOP_ABSTRACT,
    FACTUAL,
    CONDITIONAL_CONSTRAINT,
    COMPARATIVE,
    CONDITIONAL_REASONING,
    CROSS_DOCUMENT,
    UNANSWERABLE,
)

EVALUATION_TYPE_BY_NAME = {
    evaluation_type.name: evaluation_type for evaluation_type in EVALUATION_TYPES
}
QUESTION_TYPE_LABELS = {
    evaluation_type.name: evaluation_type.label for evaluation_type in EVALUATION_TYPES
}
IMPLEMENTED_EVALUATION_TYPES: t.Tuple[EvaluationTypeDefinition, ...] = (
    SINGLE_HOP_SPECIFIC,
    MULTI_HOP_ABSTRACT,
    MULTI_HOP_SPECIFIC,
    UNANSWERABLE,
)
SUPPORTED_QUERY_TYPES = tuple(
    evaluation_type.name for evaluation_type in IMPLEMENTED_EVALUATION_TYPES
)
DEFAULT_DISTRIBUTIONS = {
    evaluation_type.name: evaluation_type.default_weight
    for evaluation_type in IMPLEMENTED_EVALUATION_TYPES
    if evaluation_type.default_weight > 0
}


def normalise_distribution_weights(
    distributions: t.Optional[t.Dict[str, float]],
) -> t.Dict[str, float]:
    """接收十种类型的参数，只归一化当前已经实现的类型。"""
    raw = dict(distributions or DEFAULT_DISTRIBUTIONS)
    if not raw:
        raw = dict(DEFAULT_DISTRIBUTIONS)

    unknown = set(raw) - set(EVALUATION_TYPE_BY_NAME)
    if unknown:
        raise ValueError(f"不支持的问题类型参数：{sorted(unknown)}")

    if any(float(value) < 0 for value in raw.values()):
        raise ValueError("问题类型数量不能小于 0")

    supported = {
        name: float(raw.get(name, 0))
        for name in SUPPORTED_QUERY_TYPES
        if float(raw.get(name, 0)) > 0
    }
    total = sum(supported.values())
    if total <= 0:
        supported_labels = [QUESTION_TYPE_LABELS[name] for name in SUPPORTED_QUERY_TYPES]
        raise ValueError(f"已实现问题类型的数量之和必须大于 0：{supported_labels}")

    return {name: weight / total for name, weight in supported.items()}


def build_query_distribution(
    llm: t.Any,
    distributions: t.Optional[t.Dict[str, float]],
) -> t.List[t.Tuple[t.Any, float]]:
    weights = normalise_distribution_weights(distributions)
    return [
        (EVALUATION_TYPE_BY_NAME[name].create_synthesizer(llm), weight)
        for name, weight in weights.items()
    ]
