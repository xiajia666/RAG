"""文档解析：从上传的文件中提取纯文本。"""
import io
import os


def extract_text(filename, data):
    """根据文件扩展名提取纯文本。data 为 bytes。"""
    name = (filename or "").lower()

    if name.endswith(".pdf"):
        return _extract_pdf(data)
    if name.endswith(".docx"):
        return _extract_docx(data)
    if name.endswith((".txt", ".md", ".csv", ".json", ".py", ".log")):
        return _decode_text(data)
    # 其它类型按文本尝试解码
    return _decode_text(data)


def _decode_text(data):
    """按常见编码依次尝试解码，兼容中文文件（utf-8 / gbk / utf-16）。"""
    for enc in ("utf-8", "gbk", "utf-16"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def _extract_pdf(data):
    # 优先走 DeepDoc 深度解析（版面 + OCR + 表格）；未启用或失败则回退到 pypdf。
    if _deepdoc_enabled():
        text = _try_deepdoc_pdf(data)
        if text and text.strip():
            return text

    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages)


def _deepdoc_enabled() -> bool:
    try:
        from core import config
        return bool(getattr(config, "DEEP_DOC_ENABLED", False))
    except Exception:
        return False


def _try_deepdoc_pdf(data) -> str:
    """尝试用 DeepDoc 解析 PDF；任何失败都静默返回空串以触发回退。"""
    try:
        from core import config
        model_dir = config.DEEP_DOC_MODEL_DIR
        if not all(
            os.path.isfile(os.path.join(model_dir, name))
            for name in ("det.ort", "rec.ort", "layout.ort", "tsr.ort", "ocr.res")
        ):
            return ""
        from rag.parse_method import parse_pdf
        return parse_pdf(data, model_dir)
    except Exception:
        return ""


def _extract_docx(data):
    from docx import Document

    doc = Document(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs if p.text]
    return "\n".join(parts)
