"""DeepDoc 深度文档解析模型（Python 移植）。

参考实现：/Users/xiajia/Desktop/test_deepDos（RagFlow DeepDoc 原生推理的 Go 移植）。
本包把其中的四个 ONNX 模型用 onnxruntime + numpy + OpenCV + pyclipper 在 Python 里
等价实现：

- ``layout``  版面分析（DLA / YOLOv10）：识别标题、正文、表格、图片等区域；
- ``tsr``     表格结构识别（PP-Det）：识别表格的行 / 列 / 表头 / 跨行跨列单元格；
- ``ocr``     文字识别（DBNet 检测 + CRNN 识别）：检测并识别文字行；
- ``pdf_parser`` PDF 解析：渲染 PDF 页面 → 跑上述模型 → 合并成结构化文本。

模型权重（``det.ort`` / ``rec.ort`` / ``layout.ort`` / ``tsr.ort`` / ``ocr.res``）放在同级的
``parse_model`` 目录（默认路径见 core/config.py 的 ``DEEP_DOC_MODEL_DIR``）。
"""
from .pdf_parser import PdfParser, parse_pdf
from .layout import LayoutRecognizer
from .tsr import TableStructureRecognizer
from .ocr import TextDetector, TextRecognizer, OCR

__all__ = [
    "PdfParser",
    "parse_pdf",
    "LayoutRecognizer",
    "TableStructureRecognizer",
    "TextDetector",
    "TextRecognizer",
    "OCR",
]
