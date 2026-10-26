"""PDF 深度解析：渲染 → 版面分析 → OCR → 表格结构 → 合并成结构化文本。

对应参考实现 main.go 的任务编排（跑 DLA / TSR / DET / OCR 四个模型），并补上
RagFlow ``deepdoc/parser/pdf_parser.py`` 的思路——把版面块和 OCR 文本行按阅读顺序
合并成 markdown 文本。
"""
import os

import numpy as np

from .layout import LayoutRecognizer
from .ocr import OCR
from .tsr import TableStructureRecognizer

# 与 DeepDoc 内部渲染一致（pdftoppm -r 216）
PDF_DPI = 216


class PdfParser:
    """把 PDF 逐页渲染，用 DLA / OCR / TSR 解析并合并为 markdown 文本。"""

    def __init__(self, model_dir: str):
        self.layout = LayoutRecognizer(os.path.join(model_dir, "layout.ort"))
        self.ocr = OCR(model_dir)
        self.tsr = TableStructureRecognizer(os.path.join(model_dir, "tsr.ort"))

    # ---------- 入口 ----------

    def parse(self, pdf_data: bytes):
        """渲染 PDF 每页并解析。返回每页结构化结果列表（含 layout / lines / tables）。"""
        import fitz  # PyMuPDF

        doc = fitz.open(stream=pdf_data, filetype="pdf")
        pages = []
        try:
            for pno in range(doc.page_count):
                img = self._render(doc[pno])
                pages.append(self.parse_image(img, pno + 1))
        finally:
            doc.close()
        return pages

    def parse_to_text(self, pdf_data: bytes) -> str:
        """解析 PDF 并返回合并后的 markdown 文本。"""
        return "\n\n".join(self._merge_page(page) for page in self.parse(pdf_data))

    # ---------- 单页 ----------

    @staticmethod
    def _render(page) -> np.ndarray:
        """用 PyMuPDF 把 PDF 页渲染成 RGB numpy 数组（216 DPI）。"""
        import fitz

        zoom = PDF_DPI / 72.0
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n == 4:
            img = img[:, :, :3]
        elif pix.n == 1:
            img = np.repeat(img, 3, axis=2)
        return np.ascontiguousarray(img)  # csRGB → RGB

    def parse_image(self, img: np.ndarray, page_no=None):
        """解析单页图像，返回 {page, width, height, layout, lines, tables}。"""
        h, w = img.shape[:2]
        layout = self.layout(img)
        lines = self.ocr(img)

        tables = []
        for box in layout:
            if box["cls"] != 5:  # table
                continue
            x0, y0, x1, y1 = box["bbox"]
            ix0, iy0 = max(0, int(x0)), max(0, int(y0))
            ix1, iy1 = min(w, int(round(x1))), min(h, int(round(y1)))
            if ix1 <= ix0 or iy1 <= iy0:
                continue
            structure = self.tsr(img[iy0:iy1, ix0:ix1])
            tables.append({"bbox": box["bbox"], "offset": (ix0, iy0), "structure": structure})

        return {"page": page_no, "width": w, "height": h,
                "layout": layout, "lines": lines, "tables": tables}

    # ---------- 合并 ----------

    def _merge_page(self, page) -> str:
        """把一页的结构化结果合并成 markdown 文本。"""
        lines = page["lines"]
        layout = sorted(page["layout"], key=lambda b: (b["bbox"][1], b["bbox"][0]))

        # 每条 OCR 行按中心点归属到某个 layout 块
        line_to_block = [None] * len(lines)
        for bi, b in enumerate(layout):
            x0, y0, x1, y1 = b["bbox"]
            for li, line in enumerate(lines):
                if line_to_block[li] is not None:
                    continue
                cx = float(line["quad"][:, 0].mean())
                cy = float(line["quad"][:, 1].mean())
                if x0 <= cx <= x1 and y0 <= cy <= y1:
                    line_to_block[li] = bi

        parts = []
        for bi, b in enumerate(layout):
            inner = [lines[li] for li in range(len(lines)) if line_to_block[li] == bi]
            inner.sort(key=lambda l: (l["quad"][:, 1].min(), l["quad"][:, 0].min()))
            text = self._render_block(b, inner, page)
            if text:
                parts.append(text)

        # 不属于任何块的孤儿行（保留，按阅读顺序）
        orphans = [lines[li] for li in range(len(lines)) if line_to_block[li] is None]
        if orphans:
            orphans.sort(key=lambda l: (l["quad"][:, 1].min(), l["quad"][:, 0].min()))
            parts.append(_merge_lines(orphans))

        return "\n\n".join(p for p in parts if p)

    def _render_block(self, block, inner, page) -> str:
        cls = block["cls"]
        text = _merge_lines(inner)
        if cls == 0:  # title
            return f"## {text}" if text else ""
        if cls == 3:  # figure
            return text if text else "![图片]"
        if cls == 5:  # table
            table = next((t for t in page["tables"] if t["bbox"] == block["bbox"]), None)
            if table is not None:
                md = _table_to_markdown(table, inner)
                if md:
                    return md
            return text
        if cls == 8:  # equation
            return f"$$\n{text}\n$$" if text else ""
        return text  # text / reference / caption 等


# ---------- 文本合并与表格重建 ----------

def _merge_lines(lines) -> str:
    """把同一块内的 OCR 行按行距合并成段落。"""
    if not lines:
        return ""
    lines = sorted(lines, key=lambda l: l["quad"][:, 1].min())

    paras = []
    cur = [lines[0]]
    for l in lines[1:]:
        prev_bottom = float(cur[-1]["quad"][:, 1].max())
        this_top = float(l["quad"][:, 1].min())
        prev_h = float(cur[-1]["quad"][:, 1].max() - cur[-1]["quad"][:, 1].min())
        this_h = float(l["quad"][:, 1].max() - l["quad"][:, 1].min())
        line_h = min(prev_h, this_h) or max(prev_h, this_h) or 1.0
        if this_top - prev_bottom <= line_h * 0.6:
            cur.append(l)
        else:
            paras.append(cur)
            cur = [l]
    paras.append(cur)

    return "\n".join("".join(x["text"] for x in p) for p in paras)


def _table_to_markdown(table, lines) -> str:
    """用 TSR 结构把表格区域重建为 markdown 表格（best-effort）。

    表格结构不足两行两列时退化为普通文本。跨行跨列单元格（spanning cell）本版本暂按
    普通单元格处理——RagFlow 的完整 HTML 表格重建逻辑可作为后续增强。
    """
    structure = table["structure"]
    ox, oy = table["offset"]

    cols = sorted([b for b in structure if b["label"] == "table column"],
                  key=lambda b: b["bbox"][0])
    rows = sorted([b for b in structure if b["label"] == "table row"],
                  key=lambda b: b["bbox"][1])
    if len(cols) < 2 or len(rows) < 2:
        return _merge_lines(lines)

    col_x = sorted((b["bbox"][0] + b["bbox"][2]) / 2 for b in cols)
    row_y = sorted((b["bbox"][1] + b["bbox"][3]) / 2 for b in rows)

    # 每条 OCR 行归属到最近的行/列
    grid = {}
    for line in lines:
        cx = float(line["quad"][:, 0].mean()) - ox
        cy = float(line["quad"][:, 1].mean()) - oy
        r = int(np.argmin(np.abs(np.array(row_y) - cy)))
        c = int(np.argmin(np.abs(np.array(col_x) - cx)))
        grid[(r, c)] = (grid.get((r, c), "") + " " + line["text"].strip()).strip()

    header = [grid.get((0, c), "") for c in range(len(col_x))]
    body = []
    for r in range(1, len(row_y)):
        body.append([grid.get((r, c), "") for c in range(len(col_x))])

    def _fmt(cell):
        return cell.replace("|", "\\|").strip()

    md = []
    md.append("| " + " | ".join(_fmt(x) for x in header) + " |")
    md.append("|" + "|".join("---" for _ in cols) + "|")
    for row in body:
        md.append("| " + " | ".join(_fmt(x) for x in row) + " |")
    return "\n".join(md)


def parse_pdf(data: bytes, model_dir: str) -> str:
    """便捷入口：解析 PDF 字节并返回 markdown 文本。"""
    return PdfParser(model_dir).parse_to_text(data)
