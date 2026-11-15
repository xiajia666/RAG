"""评估问题类型的公共定义。"""
from __future__ import annotations

from dataclasses import dataclass
import typing as t


SynthesizerFactory = t.Callable[[t.Any], t.Any]


@dataclass(frozen=True)
class EvaluationTypeDefinition:
    """描述一种业务问题类型及其对应的 Ragas Synthesizer。"""

    name: str
    label: str
    implemented: bool = False
    default_weight: float = 0.0
    synthesizer_factory: t.Optional[SynthesizerFactory] = None

    def create_synthesizer(self, llm: t.Any) -> t.Any:
        if not self.implemented or self.synthesizer_factory is None:
            raise NotImplementedError(f"问题类型尚未实现：{self.label}")
        return self.synthesizer_factory(llm)
