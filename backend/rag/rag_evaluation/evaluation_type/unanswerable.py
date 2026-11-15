"""不可回答型问题的自定义 Ragas Query Synthesizer。"""
from __future__ import annotations

from dataclasses import dataclass, field
import typing as t

from pydantic import BaseModel
from ragas.dataset_schema import SingleTurnSample
from ragas.prompt import PydanticPrompt
from ragas.testset.synthesizers.single_hop.prompts import QueryCondition
from ragas.testset.synthesizers.single_hop.specific import (
    SingleHopSpecificQuerySynthesizer,
)

from .base import EvaluationTypeDefinition


if t.TYPE_CHECKING:
    from langchain_core.callbacks import Callbacks
    from ragas.testset.synthesizers.base import Scenario


UNANSWERABLE_REFERENCE = "提供的上下文不包含回答该问题所需的信息，因此无法作答。"


class GeneratedUnanswerableQuery(BaseModel):
    """LLM 只生成问题，参考答案由 Synthesizer 固定提供。"""

    query: str


class UnanswerableQueryGenerationPrompt(
    PydanticPrompt[QueryCondition, GeneratedUnanswerableQuery]
):
    """生成与上下文主题相关、但无法由上下文回答的问题。"""

    instruction: str = (
        "Generate one plausible question related to the supplied term and context, "
        "but make sure the context neither states nor implies the information needed "
        "to answer it. The question must test whether a RAG system refuses to invent "
        "missing information. Follow the requested persona, query style, and query "
        "length, and use the same primary language as the context. Do not mention the "
        "context, missing information, or that the question is unanswerable in the "
        "question itself. Return only the question in the structured output."
    )
    input_model: t.Type[QueryCondition] = QueryCondition
    output_model: t.Type[GeneratedUnanswerableQuery] = GeneratedUnanswerableQuery


@dataclass
class UnanswerableQuerySynthesizer(SingleHopSpecificQuerySynthesizer):
    """复用单跳场景采样，自定义生成不可回答问题和拒答参考答案。"""

    name: str = "unanswerable"
    generate_unanswerable_query_prompt: PydanticPrompt = field(
        default_factory=UnanswerableQueryGenerationPrompt
    )

    async def _generate_sample(
        self, scenario: Scenario, callbacks: Callbacks
    ) -> SingleTurnSample:
        reference_context = scenario.nodes[0].properties.get("page_content", "")
        prompt_input = QueryCondition(
            persona=scenario.persona,
            term=scenario.term,
            context=reference_context,
            query_length=scenario.length.value,
            query_style=scenario.style.value,
            llm_context=self.llm_context,
        )
        response = await self.generate_unanswerable_query_prompt.generate(
            data=prompt_input,
            llm=self.llm,
            callbacks=callbacks,
        )
        return SingleTurnSample(
            user_input=response.query,
            reference=UNANSWERABLE_REFERENCE,
            reference_contexts=[reference_context],
            persona_name=getattr(scenario.persona, "name", None),
            query_style=getattr(scenario.style, "name", None),
            query_length=getattr(scenario.length, "name", None),
        )


def _create_synthesizer(llm):
    return UnanswerableQuerySynthesizer(name="unanswerable", llm=llm)


EVALUATION_TYPE = EvaluationTypeDefinition(
    name="unanswerable",
    label="不可回答型",
    implemented=True,
    synthesizer_factory=_create_synthesizer,
)
