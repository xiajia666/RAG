"""文档解析：从上传的文件中提取纯文本。"""
import io


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
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages)


def _extract_docx(data):
    from docx import Document

    doc = Document(io.BytesIO(data))
    parts = [p.text for p in doc.paragraphs if p.text]
    return "\n".join(parts)
