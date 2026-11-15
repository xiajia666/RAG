import importlib.util
import sys
import types
import unittest
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from unittest import mock


def _fake_module(name, **attributes):
    module = types.ModuleType(name)
    for attribute, value in attributes.items():
        setattr(module, attribute, value)
    return module


class _FakeDocument:
    def __init__(self, page_content, metadata):
        self.page_content = page_content
        self.metadata = metadata


class _FakeSplitter:
    def __init__(self, **_kwargs):
        pass

    def split_text(self, text):
        return [text]


class _FakeRunConfig:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


@dataclass
class _FakeSynthesizer:
    name: str = ""
    llm: object = None
    llm_context: object = None


class _SingleHopSpecific(_FakeSynthesizer):
    pass


class _MultiHopSpecific(_FakeSynthesizer):
    pass


class _MultiHopAbstract(_FakeSynthesizer):
    pass


class _FakeBaseModel:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class _FakePydanticPrompt:
    def __init__(self, *_args, **_kwargs):
        pass

    @classmethod
    def __class_getitem__(cls, _item):
        return cls


class _FakeQueryCondition(_FakeBaseModel):
    pass


class _FakeSingleTurnSample(_FakeBaseModel):
    pass


class _FakeLLM:
    def __init__(self, run_config=None):
        self.run_config = run_config


class _FakeEmbeddings:
    def __init__(self, run_config=None):
        self.run_config = run_config


class _FakeTestset:
    def __init__(self, rows):
        self.rows = rows

    def to_list(self):
        return self.rows


class _FakeTestsetGenerator:
    last_call = None

    def __init__(self, llm, embedding_model):
        self.llm = llm
        self.embedding_model = embedding_model

    def generate_with_chunks(self, **kwargs):
        type(self).last_call = kwargs
        rows = [
            {
                "user_input": f"question-{synthesizer.name}",
                "reference": f"answer-{synthesizer.name}",
                "reference_contexts": ["context"],
                "synthesizer_name": synthesizer.name,
            }
            for synthesizer, _weight in kwargs["query_distribution"]
        ]
        return _FakeTestset(rows)


def _load_module():
    modules = {
        "pydantic": _fake_module("pydantic", BaseModel=_FakeBaseModel),
        "langchain": _fake_module("langchain"),
        "langchain.text_splitter": _fake_module(
            "langchain.text_splitter",
            RecursiveCharacterTextSplitter=_FakeSplitter,
        ),
        "langchain_core": _fake_module("langchain_core"),
        "langchain_core.documents": _fake_module(
            "langchain_core.documents", Document=_FakeDocument
        ),
        "ragas": _fake_module("ragas"),
        "ragas.dataset_schema": _fake_module(
            "ragas.dataset_schema", SingleTurnSample=_FakeSingleTurnSample
        ),
        "ragas.prompt": _fake_module(
            "ragas.prompt", PydanticPrompt=_FakePydanticPrompt
        ),
        "ragas.run_config": _fake_module("ragas.run_config", RunConfig=_FakeRunConfig),
        "ragas.testset": _fake_module(
            "ragas.testset", TestsetGenerator=_FakeTestsetGenerator
        ),
        "ragas.testset.synthesizers": _fake_module(
            "ragas.testset.synthesizers"
        ),
        "ragas.testset.synthesizers.multi_hop": _fake_module(
            "ragas.testset.synthesizers.multi_hop"
        ),
        "ragas.testset.synthesizers.multi_hop.abstract": _fake_module(
            "ragas.testset.synthesizers.multi_hop.abstract",
            MultiHopAbstractQuerySynthesizer=_MultiHopAbstract,
        ),
        "ragas.testset.synthesizers.multi_hop.specific": _fake_module(
            "ragas.testset.synthesizers.multi_hop.specific",
            MultiHopSpecificQuerySynthesizer=_MultiHopSpecific,
        ),
        "ragas.testset.synthesizers.single_hop": _fake_module(
            "ragas.testset.synthesizers.single_hop"
        ),
        "ragas.testset.synthesizers.single_hop.specific": _fake_module(
            "ragas.testset.synthesizers.single_hop.specific",
            SingleHopSpecificQuerySynthesizer=_SingleHopSpecific,
        ),
        "ragas.testset.synthesizers.single_hop.prompts": _fake_module(
            "ragas.testset.synthesizers.single_hop.prompts",
            QueryCondition=_FakeQueryCondition,
        ),
        "rag.rag_evaluation.wrappers": _fake_module(
            "rag.rag_evaluation.wrappers",
            CloudRagasEmbeddings=_FakeEmbeddings,
            DeepSeekRagasLLM=_FakeLLM,
        ),
    }
    source = Path(__file__).parents[1] / "rag" / "rag_evaluation" / "rag_datasets.py"
    spec = importlib.util.spec_from_file_location("rag_datasets_under_test", source)
    module = importlib.util.module_from_spec(spec)
    with mock.patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
        evaluation_types = sys.modules["rag.rag_evaluation.evaluation_type"]
        unanswerable = sys.modules[
            "rag.rag_evaluation.evaluation_type.unanswerable"
        ]
    return module, evaluation_types, unanswerable


rag_datasets, evaluation_types, unanswerable = _load_module()


class DistributionTests(unittest.TestCase):
    def test_counts_are_normalised_and_zero_types_are_omitted(self):
        weights = evaluation_types.normalise_distribution_weights(
            {
                "single_hop_specific": 2,
                "multi_hop_specific": 1,
                "multi_hop_abstract": 0,
            }
        )

        self.assertEqual(
            weights,
            {
                "single_hop_specific": 2 / 3,
                "multi_hop_specific": 1 / 3,
            },
        )

    def test_pending_types_are_accepted_but_ignored(self):
        weights = evaluation_types.normalise_distribution_weights(
            {
                "single_hop_specific": 1,
                "multi_hop_specific": 1,
                "multi_hop_abstract": 2,
                "single_hop_abstract": 10,
                "factual": 10,
                "conditional_constraint": 10,
                "comparative": 10,
                "conditional_reasoning": 10,
                "cross_document": 10,
                "unanswerable": 0,
            }
        )

        self.assertEqual(
            weights,
            {
                "single_hop_specific": 0.25,
                "multi_hop_specific": 0.25,
                "multi_hop_abstract": 0.5,
            },
        )

    def test_unanswerable_type_is_normalised_with_builtin_types(self):
        weights = evaluation_types.normalise_distribution_weights(
            {
                "single_hop_specific": 1,
                "unanswerable": 1,
            }
        )

        self.assertEqual(
            weights,
            {
                "single_hop_specific": 0.5,
                "unanswerable": 0.5,
            },
        )

    def test_unknown_type_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unknown_type"):
            evaluation_types.normalise_distribution_weights(
                {"single_hop_specific": 1, "unknown_type": 1}
            )

    def test_at_least_one_implemented_type_must_be_requested(self):
        with self.assertRaisesRegex(ValueError, "已实现问题类型"):
            evaluation_types.normalise_distribution_weights({"factual": 1})

    def test_query_distribution_uses_the_three_builtin_synthesizers(self):
        distribution = evaluation_types.build_query_distribution(_FakeLLM(), None)

        self.assertEqual(
            [type(synthesizer) for synthesizer, _weight in distribution],
            [_SingleHopSpecific, _MultiHopAbstract, _MultiHopSpecific],
        )
        self.assertEqual(
            [synthesizer.name for synthesizer, _weight in distribution],
            ["single_hop_specific", "multi_hop_abstract", "multi_hop_specific"],
        )

    def test_query_distribution_builds_custom_unanswerable_synthesizer(self):
        distribution = evaluation_types.build_query_distribution(
            _FakeLLM(), {"unanswerable": 1}
        )

        synthesizer, weight = distribution[0]
        self.assertIsInstance(synthesizer, unanswerable.UnanswerableQuerySynthesizer)
        self.assertEqual(synthesizer.name, "unanswerable")
        self.assertEqual(weight, 1.0)


class UnanswerableSynthesizerTests(unittest.IsolatedAsyncioTestCase):
    async def test_sample_contains_generated_query_and_fixed_refusal_reference(self):
        class _Prompt:
            async def generate(self, **kwargs):
                self.kwargs = kwargs
                return SimpleNamespace(query="这项技术首次商业部署是在什么时候？")

        prompt = _Prompt()
        synthesizer = unanswerable.UnanswerableQuerySynthesizer(
            name="unanswerable",
            llm=_FakeLLM(),
            generate_unanswerable_query_prompt=prompt,
        )
        scenario = SimpleNamespace(
            nodes=[SimpleNamespace(properties={"page_content": "文档只介绍了技术原理。"})],
            persona=SimpleNamespace(name="研发工程师"),
            term="技术",
            style=SimpleNamespace(value="Perfect grammar", name="PERFECT_GRAMMAR"),
            length=SimpleNamespace(value="short", name="SHORT"),
        )

        sample = await synthesizer._generate_sample(scenario, callbacks=[])

        self.assertEqual(sample.user_input, "这项技术首次商业部署是在什么时候？")
        self.assertEqual(sample.reference, unanswerable.UNANSWERABLE_REFERENCE)
        self.assertEqual(sample.reference_contexts, ["文档只介绍了技术原理。"])
        self.assertEqual(prompt.kwargs["data"].term, "技术")
        self.assertEqual(prompt.kwargs["data"].context, "文档只介绍了技术原理。")


class GenerationTests(unittest.TestCase):
    def test_generation_keeps_the_existing_response_contract(self):
        result = rag_datasets.generate_testset(
            documents=[{"filename": "guide.md", "text": "document text"}],
            test_size=3,
            distributions={
                "single_hop_specific": 1,
                "multi_hop_specific": 1,
                "multi_hop_abstract": 1,
                "single_hop_abstract": 1,
                "factual": 1,
                "conditional_constraint": 1,
                "comparative": 1,
                "conditional_reasoning": 1,
                "cross_document": 1,
                "unanswerable": 0,
            },
        )

        self.assertEqual(result["total"], 3)
        self.assertEqual(
            {row["question_type"] for row in result["testset"]},
            {
                "single_hop_specific",
                "multi_hop_specific",
                "multi_hop_abstract",
            },
        )
        self.assertEqual(
            set(result["testset"][0]),
            {
                "question",
                "answer",
                "question_type",
                "question_type_label",
                "contexts",
            },
        )
        self.assertEqual(_FakeTestsetGenerator.last_call["testset_size"], 3)

    def test_generation_supports_custom_unanswerable_type(self):
        result = rag_datasets.generate_testset(
            documents=[{"filename": "guide.md", "text": "document text"}],
            test_size=1,
            distributions={"unanswerable": 1},
        )

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["testset"][0]["question_type"], "unanswerable")
        self.assertEqual(result["testset"][0]["question_type_label"], "不可回答型")


if __name__ == "__main__":
    unittest.main()
