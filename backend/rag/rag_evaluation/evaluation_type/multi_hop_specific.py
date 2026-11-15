"""多跳具体问题。"""
from ragas.testset.synthesizers.multi_hop.specific import (
    MultiHopSpecificQuerySynthesizer,
)

from .base import EvaluationTypeDefinition


def _create_synthesizer(llm):
    return MultiHopSpecificQuerySynthesizer(name="multi_hop_specific", llm=llm)


EVALUATION_TYPE = EvaluationTypeDefinition(
    name="multi_hop_specific",
    label="多跳具体",
    implemented=True,
    default_weight=0.25,
    synthesizer_factory=_create_synthesizer,
)
