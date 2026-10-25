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
