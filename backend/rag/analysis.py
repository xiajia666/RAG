"""文档预分析：计算用于分块策略推荐的「文档规模指标」。

指标列表（对应前端「文档规模指标」分类）：
- page_count            文档物理页数
- char_count            有效文本字符总数
- estimated_tokens      使用目标 tokenizer 估算的 Token 数
- avg_tokens_per_page   总 Token / 页数
- max_tokens_per_page   单页最大 Token 数（识别密度峰值）
- min_tokens_per_page   单页最小 Token 数（识别密度谷值）
- blank_page_count      空白页数（无文本内容）
- short_element_ratio   过短文本元素数 / 文本元素总数
- long_element_ratio    超长文本元素数 / 文本元素总数

PDF 的页数、逐页 Token、空白页通过 PyMuPDF 计算；文本抽取在 parsing.extract_text 中
同样使用 PyMuPDF。非 PDF 文档无物理页概念，按有效字符数折算页数。

阈值说明：短/长元素的长度阈值需按实际文档校准，不能把所有短元素都视为噪声——
列表项、标题、参数值可能很短，但有很高的检索价值。
"""
import re

# 元素长度阈值（字符数，去除空白后）。需按实际文档校准。
SHORT_ELEMENT_CHARS = 30
LONG_ELEMENT_CHARS = 500
# 非 PDF 文档折算页数时，每页约含的有效字符数。
CHARS_PER_PAGE = 1200

_WS = re.compile(r"\s")
_CJK = re.compile(r"[一-鿿㐀-䶿豈-﫿]")


def estimate_tokens(text: str) -> int:
    """粗略估算 Token 数：中文字符约 1 token/字，其余字符约 4 字符/token。

    这是无 tokenizer 依赖的估算；接入目标模型（LLM / Embedding）的真实 tokenizer 后应替换。
    """
    if not text:
        return 0
    non_ws = _WS.sub("", text)
    cjk = len(_CJK.findall(non_ws))
    other = max(0, len(non_ws) - cjk)
    return cjk + (other + 3) // 4


def _open_pdf(data: bytes):
    """用 PyMuPDF 打开 PDF 字节流。"""
    try:
        import pymupdf as fitz
    except ImportError:  # PyMuPDF < 1.24 仍用 fitz 作为模块名
        import fitz
    return fitz.open(stream=data, filetype="pdf")


def _pdf_page_stats(data: bytes):
    """逐页提取文本并统计，返回 (page_count, per_page_tokens, blank_page_count)。"""
    doc = _open_pdf(data)
    try:
        per_page = [estimate_tokens(page.get_text("text") or "") for page in doc]
    finally:
        doc.close()
    blank = sum(1 for t in per_page if t <= 0)
    return len(per_page), per_page, blank


def compute_document_size_index(filename: str, data: bytes, text: str) -> dict:
    """计算文档规模指标。text 为已提取的纯文本。"""
    char_count = len(_WS.sub("", text))
    tokens = estimate_tokens(text)
    is_pdf = (filename or "").lower().endswith(".pdf")

    if is_pdf:
        page_count, per_page, blank_page_count = _pdf_page_stats(data)
        max_per_page = max(per_page) if per_page else 0
        min_per_page = min(per_page) if per_page else 0
    else:
        page_count = max(1, round(char_count / CHARS_PER_PAGE))
        blank_page_count = 0
        max_per_page = min_per_page = tokens

    elements = [line for line in text.splitlines() if line.strip()]
    total = len(elements)
    short_count = sum(1 for e in elements if len(_WS.sub("", e)) < SHORT_ELEMENT_CHARS)
    long_count = sum(1 for e in elements if len(_WS.sub("", e)) > LONG_ELEMENT_CHARS)

    return {
        "filename": filename,
        "page_count": page_count,
        "char_count": char_count,
        "estimated_tokens": tokens,
        "avg_tokens_per_page": round(tokens / page_count, 2),
        "max_tokens_per_page": max_per_page,
        "min_tokens_per_page": min_per_page,
        "blank_page_count": blank_page_count,
        "blank_page_ratio": round(blank_page_count / page_count, 4) if page_count else 0.0,
        "short_element_ratio": round(short_count / total, 4) if total else 0.0,
        "long_element_ratio": round(long_count / total, 4) if total else 0.0,
        # 辅助字段：便于前端展示分子/分母
        "total_elements": total,
        "short_element_count": short_count,
        "long_element_count": long_count,
    }


# ---------- 结构化程度指标 ----------

# 标题 / 列表 / 问答 识别正则（启发式，需按实际文档校准）
_HEADING_MD = re.compile(r"^(#{1,6})\s+\S")
_HEADING_CN_CHAPTER = re.compile(r"^第[一二三四五六七八九十百零0-9]+[章节篇部分]")
_HEADING_NUMBERED = re.compile(r"^(\d+(?:\.\d+)+)[\s、.)）]")
_HEADING_CN_NUM = re.compile(r"^[一二三四五六七八九十]+、\s*\S")
_LIST_ITEM = re.compile(r"^\s*(?:[-*•·]|\d+[、.)]|[(（]\d+[)）]|[一二三四五六七八九十]+[、])\s*\S")
_QA_Q = re.compile(r"^(?:Q|问)\s*[:：]\s*\S", re.IGNORECASE)
_QA_A = re.compile(r"^(?:A|答)\s*[:：]\s*\S", re.IGNORECASE)


def _classify_line(line: str):
    """把一行文本归类，返回 (类型, 层级)。类型 ∈ heading/list/question/answer/body。

    标题识别采用启发式：Markdown #、第X章/节、多级编号（1.1/1.1.1）、
    短的中文数字标题（一、二、…且不以句末标点结尾）。
    """
    s = line.strip()
    m = _HEADING_MD.match(s)
    if m:
        return "heading", len(m.group(1))
    if _HEADING_CN_CHAPTER.match(s):
        level = 1 if any(ch in s[:8] for ch in "章篇") else 2
        return "heading", level
    m = _HEADING_NUMBERED.match(s)
    if m:
        return "heading", m.group(1).count(".") + 1
    if _HEADING_CN_NUM.match(s) and len(s) <= 40 and not s.endswith(("。", "！", "？", ".", "!", "?")):
        return "heading", 1
    if _QA_Q.match(s) or s.endswith("?") or s.endswith("？"):
        return "question", None
    if _QA_A.match(s):
        return "answer", None
    if _LIST_ITEM.match(s):
        return "list", None
    return "body", None


def compute_structure_index(filename: str, data: bytes, text: str) -> dict:
    """计算结构化程度指标。

    指标：
    - heading_density     标题数 / 1000 正文 Token
    - heading_level_count 识别到的有效标题层级数
    - heading_coverage    能关联到标题路径的正文 Token / 正文 Token 总数
    - paragraph_count     正文段落数
    - list_ratio          列表内容 Token / 正文 Token
    - qa_ratio            问答对内容 Token / 正文 Token
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    empty = {
        "filename": filename,
        "heading_density": 0.0,
        "heading_level_count": 0,
        "heading_coverage": 0.0,
        "paragraph_count": 0,
        "list_ratio": 0.0,
        "qa_ratio": 0.0,
        "heading_count": 0,
        "body_tokens": 0,
        "heading_tokens": 0,
        "list_tokens": 0,
        "qa_tokens": 0,
    }
    if not lines:
        return empty

    kinds = [_classify_line(line) for line in lines]

    # 把「问句」后面紧跟的正文/列表行归为「答案」，一并纳入问答内容
    for i in range(len(kinds) - 1):
        if kinds[i][0] == "question" and kinds[i + 1][0] in ("body", "list"):
            kinds[i + 1] = ("answer", None)

    tok = estimate_tokens
    heading_tokens = sum(tok(lines[i]) for i in range(len(lines)) if kinds[i][0] == "heading")
    body_tokens = sum(tok(lines[i]) for i in range(len(lines)) if kinds[i][0] != "heading")

    heading_count = sum(1 for kind, _ in kinds if kind == "heading")
    heading_levels = {level for kind, level in kinds if kind == "heading" and level}

    # heading_coverage：处于某个标题路径下的正文 token 占比
    covered = 0
    in_section = False
    for i in range(len(lines)):
        kind = kinds[i][0]
        if kind == "heading":
            in_section = True
        elif in_section:
            covered += tok(lines[i])

    # paragraph_count：连续的 body 行合并为一个段落
    paragraph_count = 0
    prev_body = False
    for kind, _ in kinds:
        if kind == "body":
            if not prev_body:
                paragraph_count += 1
            prev_body = True
        else:
            prev_body = False

    list_tokens = sum(tok(lines[i]) for i in range(len(lines)) if kinds[i][0] == "list")
    qa_tokens = sum(tok(lines[i]) for i in range(len(lines)) if kinds[i][0] in ("question", "answer"))

    return {
        "filename": filename,
        "heading_density": round(heading_count * 1000 / body_tokens, 2) if body_tokens else 0.0,
        "heading_level_count": len(heading_levels),
        "heading_coverage": round(covered / body_tokens, 4) if body_tokens else 0.0,
        "paragraph_count": paragraph_count,
        "list_ratio": round(list_tokens / body_tokens, 4) if body_tokens else 0.0,
        "qa_ratio": round(qa_tokens / body_tokens, 4) if body_tokens else 0.0,
        # 辅助字段
        "heading_count": heading_count,
        "body_tokens": body_tokens,
        "heading_tokens": heading_tokens,
        "list_tokens": list_tokens,
        "qa_tokens": qa_tokens,
    }


# ---------- 内容类型分布指标 ----------

_CODE_FENCE = re.compile(r"^```")
_CODE_HINT = re.compile(
    r"^\s*(?:def |class |import |from \S+ import |function |const |let |var |return "
    r"|public |private |protected |#include|using namespace |SELECT |INSERT |UPDATE |DELETE )",
    re.IGNORECASE,
)
_MD_TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
_FORMULA_LATEX = re.compile(r"\$\$[^$]*\$\$|\$[^$\n]*\$|\\\([^)\n]*\\\)|\\\[[^\]]*\\\]")
_FORMULA_SYMBOL = re.compile(r"[∑∫√π∞∂≈≠≤≥∈±×÷Ωαβγδεζηθλμνξρστφψω]")


def _code_tokens(lines) -> int:
    """代码 Token：markdown ``` 围栏内 + 代码特征行。"""
    tokens = 0
    in_fence = False
    for line in lines:
        if _CODE_FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence or _CODE_HINT.match(line):
            tokens += estimate_tokens(line)
    return tokens


def _markdown_table_tokens(lines) -> int:
    """markdown 表格 Token（连续的 | 行）。"""
    tokens = 0
    i, n = 0, len(lines)
    while i < n:
        if _MD_TABLE_ROW.match(lines[i]):
            while i < n and _MD_TABLE_ROW.match(lines[i]):
                tokens += estimate_tokens(lines[i])
                i += 1
        else:
            i += 1
    return tokens


def _qa_pair_tokens(lines) -> int:
    """完整问答对覆盖的 Token（问题行 + 紧跟的答案行都计入）。"""
    tokens = 0
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if _QA_Q.match(line) or line.endswith("?") or line.endswith("？"):
            tokens += estimate_tokens(line)
            if i + 1 < n:
                nxt = lines[i + 1]
                if _QA_A.match(nxt):
                    tokens += estimate_tokens(nxt)
                    i += 1
                elif nxt.strip() and not (nxt.endswith("?") or nxt.endswith("？")):
                    tokens += estimate_tokens(nxt)
                    i += 1
        elif _QA_A.match(line):
            tokens += estimate_tokens(line)
        i += 1
    return tokens


def _formula_tokens(lines) -> int:
    """公式 Token：LaTeX 数学定界符内的内容 + 数学符号密集行。"""
    tokens = 0
    for line in lines:
        matched = False
        for m in _FORMULA_LATEX.finditer(line):
            tokens += estimate_tokens(m.group(0))
            matched = True
        if not matched and len(_FORMULA_SYMBOL.findall(line)) >= 2:
            tokens += estimate_tokens(line)
    return tokens


def _pdf_image_stats(data: bytes):
    """PDF 图片统计，返回 (image_page_ratio, image_area_ratio)。"""
    try:
        doc = _open_pdf(data)
        try:
            total_pages = doc.page_count
            image_pages = 0
            image_area = 0.0
            page_area_total = 0.0
            for page in doc:
                rect = page.rect
                page_area_total += rect.width * rect.height
                info = page.get_image_info(xrefs=True)
                if info:
                    image_pages += 1
                    for img in info:
                        bbox = img.get("bbox")
                        if bbox:
                            w = max(0.0, bbox[2] - bbox[0])
                            h = max(0.0, bbox[3] - bbox[1])
                            image_area += w * h
        finally:
            doc.close()
        image_page_ratio = round(image_pages / total_pages, 4) if total_pages else 0.0
        image_area_ratio = round(image_area / page_area_total, 4) if page_area_total else 0.0
        return image_page_ratio, image_area_ratio
    except Exception:
        return 0.0, 0.0


def _pdf_table_stats(data: bytes):
    """PDF 表格统计，返回 (table_tokens, table_candidates, table_success)。"""
    try:
        doc = _open_pdf(data)
        try:
            table_tokens = 0
            candidates = 0
            success = 0
            for page in doc:
                for table in page.find_tables().tables:
                    candidates += 1
                    if table.row_count >= 2 and table.col_count >= 2:
                        success += 1
                    cell_text = page.get_text("text", clip=table.bbox) or ""
                    table_tokens += estimate_tokens(cell_text)
        finally:
            doc.close()
        return table_tokens, candidates, success
    except Exception:
        return 0, 0, 0


def compute_content_type_index(filename: str, data: bytes, text: str) -> dict:
    """计算内容类型分布指标。

    指标（分母统一为「全部有效内容 Token」，表格文本已含于其中、不重复计入分母）：
    - table_token_ratio            表格内容 Token / 全部内容 Token
    - code_token_ratio             代码 Token / 全部内容 Token
    - qa_pair_ratio                完整问答对覆盖 Token / 全部内容 Token
    - image_page_ratio             含图片页数 / 总页数
    - image_area_ratio             图片实例覆盖面积 / 页面总面积
    - formula_ratio                公式 Token / 全部内容 Token
    - table_structure_success_rate 成功恢复结构(≥2行≥2列)的表格 / 表格候选总数
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    total_tokens = estimate_tokens(text)

    code_tokens = _code_tokens(lines)
    md_table_tokens = _markdown_table_tokens(lines)
    qa_pair_tokens = _qa_pair_tokens(lines)
    formula_tokens = _formula_tokens(lines)

    is_pdf = (filename or "").lower().endswith(".pdf")
    image_page_ratio = 0.0
    image_area_ratio = 0.0
    pdf_table_tokens = 0
    table_candidates = 0
    table_success = 0
    if is_pdf:
        image_page_ratio, image_area_ratio = _pdf_image_stats(data)
        pdf_table_tokens, table_candidates, table_success = _pdf_table_stats(data)

    table_tokens = pdf_table_tokens + md_table_tokens

    return {
        "filename": filename,
        "table_token_ratio": round(table_tokens / total_tokens, 4) if total_tokens else 0.0,
        "code_token_ratio": round(code_tokens / total_tokens, 4) if total_tokens else 0.0,
        "qa_pair_ratio": round(qa_pair_tokens / total_tokens, 4) if total_tokens else 0.0,
        "image_page_ratio": image_page_ratio,
        "image_area_ratio": image_area_ratio,
        "formula_ratio": round(formula_tokens / total_tokens, 4) if total_tokens else 0.0,
        "table_structure_success_rate": round(table_success / table_candidates, 4) if table_candidates else 0.0,
        # 辅助字段
        "total_tokens": total_tokens,
        "table_tokens": table_tokens,
        "code_tokens": code_tokens,
        "qa_pair_tokens": qa_pair_tokens,
        "formula_tokens": formula_tokens,
        "table_candidates": table_candidates,
        "table_success": table_success,
    }


# ---------- 表格与图片指标 ----------

def _rect_union_area(rects):
    """轴对齐矩形的并集面积（扫描线法）。rects 为 (x0, y0, x1, y1) 列表。"""
    if not rects:
        return 0.0
    xs = sorted({x for r in rects for x in (r[0], r[2])})
    area = 0.0
    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        if x1 <= x0:
            continue
        ys = sorted((r[1], r[3]) for r in rects if r[0] <= x0 and r[2] >= x1)
        if not ys:
            continue
        y_union = 0.0
        cur_y0, cur_y1 = ys[0]
        for y0, y1 in ys[1:]:
            if y0 <= cur_y1:
                cur_y1 = max(cur_y1, y1)
            else:
                y_union += cur_y1 - cur_y0
                cur_y0, cur_y1 = y0, y1
        y_union += cur_y1 - cur_y0
        area += (x1 - x0) * y_union
    return area


def _pdf_table_image_stats(data: bytes) -> dict:
    """PDF 表格与图片统计（单次遍历所有页）。"""
    stats = {
        "table_tokens": 0, "table_candidates": 0, "table_success": 0, "table_success_rows": 0,
        "image_instances": 0, "image_pages": 0, "image_union_area": 0.0,
        "page_area_total": 0.0, "image_semantic": 0, "image_total": 0, "page_count": 0,
    }
    try:
        doc = _open_pdf(data)
        try:
            stats["page_count"] = doc.page_count
            for page in doc:
                rect = page.rect
                stats["page_area_total"] += rect.width * rect.height
                # 表格：候选 + 结构恢复（≥2 行 ≥2 列视为成功）
                for table in page.find_tables().tables:
                    stats["table_candidates"] += 1
                    if table.row_count >= 2 and table.col_count >= 2:
                        stats["table_success"] += 1
                        stats["table_success_rows"] += table.row_count
                    stats["table_tokens"] += estimate_tokens(page.get_text("text", clip=table.bbox) or "")
                # 图片：实例数、并集面积、语义覆盖（图片区域内是否有文本层）
                info = page.get_image_info(xrefs=True)
                if info:
                    stats["image_pages"] += 1
                rects = []
                for img in info:
                    stats["image_instances"] += 1
                    stats["image_total"] += 1
                    bbox = img.get("bbox")
                    if bbox:
                        rects.append((bbox[0], bbox[1], bbox[2], bbox[3]))
                        if (page.get_text("text", clip=bbox) or "").strip():
                            stats["image_semantic"] += 1
                stats["image_union_area"] += _rect_union_area(rects)
        finally:
            doc.close()
    except Exception:
        pass
    return stats


def compute_table_image_index(filename: str, data: bytes, text: str) -> dict:
    """计算表格与图片指标。

    指标：
    - table_token_ratio       表格内容 Token /（正文文本 Token + 表格文本 Token）
    - table_recovery_rate     成功恢复结构(≥2行≥2列)的表格数 / 表格候选数
    - table_avg_rows          成功恢复表格的平均行数
    - image_count_per_page    图片实例数 / 页数
    - image_page_coverage     图片区域并集面积 / 页面总面积
    - image_semantic_coverage 有有效 OCR/视觉描述的图片数 / 图片总数（近似：图片区域内有文本层）
    """
    total_tokens = estimate_tokens(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    md_table_tokens = _markdown_table_tokens(lines)

    is_pdf = (filename or "").lower().endswith(".pdf")
    if is_pdf:
        stats = _pdf_table_image_stats(data)
        table_tokens = stats["table_tokens"] + md_table_tokens
        candidates = stats["table_candidates"]
        success = stats["table_success"]
        avg_rows = round(stats["table_success_rows"] / success, 2) if success else 0.0
        page_count = stats["page_count"]
        image_instances = stats["image_instances"]
        image_total = stats["image_total"]
        image_semantic = stats["image_semantic"]
        image_union_area = stats["image_union_area"]
        page_area_total = stats["page_area_total"]
    else:
        table_tokens = md_table_tokens
        candidates = 0
        success = 0
        avg_rows = 0.0
        page_count = max(1, round(len(_WS.sub("", text)) / CHARS_PER_PAGE))
        image_instances = 0
        image_total = 0
        image_semantic = 0
        image_union_area = 0.0
        page_area_total = 0.0

    return {
        "filename": filename,
        "table_token_ratio": round(table_tokens / total_tokens, 4) if total_tokens else 0.0,
        "table_recovery_rate": round(success / candidates, 4) if candidates else 0.0,
        "table_avg_rows": avg_rows,
        "image_count_per_page": round(image_instances / page_count, 2) if page_count else 0.0,
        "image_page_coverage": round(image_union_area / page_area_total, 4) if page_area_total else 0.0,
        "image_semantic_coverage": round(image_semantic / image_total, 4) if image_total else 0.0,
        # 辅助字段
        "total_tokens": total_tokens,
        "body_tokens": max(0, total_tokens - table_tokens),
        "table_tokens": table_tokens,
        "table_candidates": candidates,
        "table_success": success,
        "image_instances": image_instances,
        "image_total": image_total,
        "image_semantic": image_semantic,
        "page_count": page_count,
    }
