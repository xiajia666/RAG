"""多跳抽象问题。"""
from ragas.testset.synthesizers.multi_hop.abstract import (
    MultiHopAbstractQuerySynthesizer,
)

from .base import EvaluationTypeDefinition


def _create_synthesizer(llm):
    return MultiHopAbstractQuerySynthesizer(name="multi_hop_abstract", llm=llm)


EVALUATION_TYPE = EvaluationTypeDefinition(
    name="multi_hop_abstract",
    label="多跳抽象",
    implemented=True,
    default_weight=0.25,
    synthesizer_factory=_create_synthesizer,
)
