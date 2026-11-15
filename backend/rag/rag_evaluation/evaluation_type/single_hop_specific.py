"""单跳具体问题。"""
from ragas.testset.synthesizers.single_hop.specific import (
    SingleHopSpecificQuerySynthesizer,
)

from .base import EvaluationTypeDefinition


def _create_synthesizer(llm):
    return SingleHopSpecificQuerySynthesizer(name="single_hop_specific", llm=llm)


EVALUATION_TYPE = EvaluationTypeDefinition(
    name="single_hop_specific",
    label="单跳具体",
    implemented=True,
    default_weight=0.5,
    synthesizer_factory=_create_synthesizer,
)
