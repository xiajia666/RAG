"""AI 分块策略推荐：基于评估 skill 与文档指标，调用 LLM 生成分块参数推荐。

评估 skill 位于 parse_skill/ai_recommend_skill.md，定义了输入契约（文档指标 JSON）与
输出契约（分块参数 JSON）。本模块负责：
1. 计算三类指标（规模 / 结构 / 内容类型）并映射到 skill 的输入契约；
2. 以 skill 作为 system prompt，指标 JSON 作为 user 输入，调用 DeepSeek；
3. 解析并返回 LLM 生成的分块推荐（chunk size / overlap / separators / strategy / TopK 等）。
"""
import json
import os

from rag import analysis, llm

SKILL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "parse_skill", "ai_recommend_skill.md")

_FILE_TYPES = {
    "pdf": "pdf", "docx": "docx", "doc": "docx", "md": "markdown", "markdown": "markdown",
    "html": "html", "htm": "html", "txt": "txt", "csv": "csv", "xlsx": "xlsx", "xls": "xlsx",
}


def load_skill() -> str:
    with open(SKILL_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _file_type(filename: str) -> str:
    ext = (filename or "").rsplit(".", 1)[-1].lower()
    return _FILE_TYPES.get(ext, "other")


def _heading_structure(structure: dict) -> str:
    if structure.get("heading_count", 0) == 0:
        return "none"
    return "clear" if structure.get("heading_coverage", 0.0) >= 0.8 else "partial"


def build_metrics_payload(doc: dict, data: bytes, text: str) -> dict:
    """计算三类指标并映射到 skill 的输入契约（缺失值用 null，不臆造）。"""
    size = analysis.compute_document_size_index(doc["filename"], data, text)
    structure = analysis.compute_structure_index(doc["filename"], data, text)
    content = analysis.compute_content_type_index(doc["filename"], data, text)

    paragraph_count = structure["paragraph_count"]
    body_tokens = structure["body_tokens"]
    avg_paragraph_tokens = round(body_tokens / paragraph_count) if paragraph_count else None

    qa_pair_ratio = content["qa_pair_ratio"]
    code_ratio = content["code_token_ratio"]

    return {
        "document": {
            "document_id": doc["id"],
            "file_type": _file_type(doc["filename"]),
            "language": "zh-CN",
            "page_count": size["page_count"],
            "total_tokens": size["estimated_tokens"],
            "parser_name": "pymupdf",
        },
        "metrics": {
            # 结构
            "heading_structure": _heading_structure(structure),
            "heading_hierarchy_coverage": structure["heading_coverage"],
            "heading_density": structure["heading_density"],
            "paragraph_count": paragraph_count,
            "avg_paragraph_tokens": avg_paragraph_tokens,
            "p50_paragraph_tokens": None,
            "p90_paragraph_tokens": None,
            "paragraph_length_cv": None,
            "long_paragraph_ratio": size["long_element_ratio"],
            "list_ratio": structure["list_ratio"],
            "topic_count_estimate": None,
            "topic_switch_rate": None,
            # 表格
            "table_count": content["table_candidates"],
            "table_token_ratio": content["table_token_ratio"],
            "large_table_ratio": None,
            "table_header_detection_rate": None,
            "table_structure_confidence": content["table_recovery_rate"],
            "table_text_dependency": None,
            # 图片
            "image_count": content["image_total"],
            "image_density": content["image_page_coverage"],
            "figure_caption_coverage": None,
            "image_text_dependency": None,
            "ocr_page_ratio": None,
            "ocr_confidence": None,
            "layout_confidence": None,
            "reading_order_violation_rate": None,
            # 特殊内容
            "is_qa_document": bool(qa_pair_ratio >= 0.3),
            "qa_pair_count": None,
            "qa_pair_integrity": None,
            "qa_detection_confidence": None,
            "code_ratio": code_ratio,
            "is_code_dense": bool(code_ratio >= 0.1),
            "code_detection_confidence": None,
            "function_class_detection_rate": None,
            "formula_ratio": content["formula_ratio"],
            "citation_density": None,
            "boilerplate_ratio": None,
            # 质量
            "parse_quality_score": None,
            "header_footer_repeat_rate": None,
            "header_footer_candidate_count": None,
            "source_mapping_coverage": None,
        },
    }


def _parse_json(raw: str):
    """从 LLM 输出中提取 JSON（容忍 markdown 代码块包裹）。"""
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start >= 0 and end > start:
        raw = raw[start:end + 1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"error": "解析推荐结果失败", "raw": raw}


def recommend_chunking(doc: dict, data: bytes, text: str) -> dict:
    """调用 LLM 生成分块策略推荐，返回结构化 JSON。"""
    skill = load_skill()
    payload = build_metrics_payload(doc, data, text)
    user_content = (
        "请基于以下文档指标，给出分块策略推荐。\n"
        "只返回符合 Output contract 的 JSON，不要输出任何解释性文字或 markdown 代码块。\n"
        "所有描述性文字（warnings、parameter_reasons 的说明等）用中文输出；JSON 键名与枚举值（status、strategy 名等）保持英文契约不变。\n\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
    )
    messages = [
        {"role": "system", "content": skill},
        {"role": "user", "content": user_content},
    ]
    raw = llm.chat(messages, temperature=0.2, max_tokens=8192)
    return _parse_json(raw)
