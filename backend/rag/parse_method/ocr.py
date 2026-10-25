"""OCR：DBNet 文本检测 + CRNN 文本识别。

对应参考实现 native/det.go、det_core.go、det_helpers.go（检测）、ocr_rec.go（识别）。
注意通道顺序：DET 用 RGB（mean/std 归一化），REC 用 BGR（(x/255-0.5)/0.5），与 Go 参考一致。
"""
import os

import cv2
import numpy as np

from .postprocess import DBPostProcess
from .session import run

# 检测参数（对应 det.go 常量）
DET_LIMIT_SIDE_LEN = 960
DET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
DET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# 识别参数（对应 ocr_rec.go 常量）
REC_H = 48
REC_W = 320
REC_VOCAB = 6625


class TextDetector:
    """DBNet 文本检测（对应 det.go + det_core.go）。输入 RGB HWC，返回 [N,4,2] int16 框。"""

    def __init__(self, model_path: str):
        self.model_path = model_path
        self.postprocess = DBPostProcess()

    def __call__(self, img: np.ndarray) -> np.ndarray:
        src_h, src_w = img.shape[:2]
        blob, rh, rw = self._preprocess(img)
        out = run(self.model_path, "x", "sigmoid_0.tmp_0", blob)
        pred = np.asarray(out, dtype=np.float32).reshape(rh, rw)
        boxes, _ = self.postprocess(pred, src_w, src_h)
        return self._filter_tag_det_res(boxes, src_h, src_w)

    @staticmethod
    def _preprocess(img):
        """DetResizeForTest + NormalizeImage + ToCHW（对应 detPreprocess）。"""
        h, w = img.shape[:2]
        ratio = 1.0
        if max(h, w) > DET_LIMIT_SIDE_LEN:
            ratio = DET_LIMIT_SIDE_LEN / max(h, w)
        rh = int(round(h * ratio))
        rw = int(round(w * ratio))
        rh = max(int(round(rh / 32)) * 32, 32)
        rw = max(int(round(rw / 32)) * 32, 32)
        resized = cv2.resize(img, (rw, rh), interpolation=cv2.INTER_LINEAR)
        blob = resized.astype(np.float32) / 255.0
        blob = (blob - DET_MEAN) / DET_STD
        blob = blob.transpose(2, 0, 1)  # CHW，RGB
        return np.ascontiguousarray(blob[None], dtype=np.float32), rh, rw

    @staticmethod
    def _filter_tag_det_res(dt_boxes, src_h, src_w):
        """顺时针排序 + 裁剪 + 丢弃过小框（对应 filterTagDetRes）。"""
        out = []
        for box in dt_boxes:
            box = TextDetector._order_points_clockwise(box)
            box = np.clip(box, 0, [src_w - 1, src_h - 1])
            rect_w = int(np.linalg.norm(box[0] - box[1]))
            rect_h = int(np.linalg.norm(box[0] - box[3]))
            if rect_w <= 3 or rect_h <= 3:
                continue
            out.append(box)
        if not out:
            return np.zeros((0, 4, 2), dtype=np.int16)
        return np.array(out, dtype=np.int16)

    @staticmethod
    def _order_points_clockwise(pts):
        """按 x 排序后重排成顺时针四点（对应 getMiniBoxes）。"""
        s = sorted(pts, key=lambda p: p[0])
        if s[1][1] > s[0][1]:
            i1, i4 = 0, 1
        else:
            i1, i4 = 1, 0
        if s[3][1] > s[2][1]:
            i2, i3 = 2, 3
        else:
            i2, i3 = 3, 2
        return np.array([s[i1], s[i2], s[i3], s[i4]], dtype=pts.dtype)


class TextRecognizer:
    """CRNN 文本识别（对应 ocr_rec.go）。输入 RGB HWC 行图，返回 (text, score)。"""

    def __init__(self, model_path: str, dict_path: str):
        self.model_path = model_path
        self.char_dict = ["blank"] + self._load_dict(dict_path) + [" "]

    @staticmethod
    def _load_dict(path):
        with open(path, "r", encoding="utf-8") as f:
            lines = f.read().split("\n")
        if lines and lines[-1] == "":
            lines = lines[:-1]
        return lines

    def __call__(self, img: np.ndarray):
        h, w = img.shape[:2]
        max_wh_ratio = max(REC_W / REC_H, w / h)
        blob = self._preprocess(img, max_wh_ratio)
        out = run(self.model_path, "x", "softmax_11.tmp_0", blob)
        return self._ctc_decode(np.asarray(out, dtype=np.float32))

    @staticmethod
    def _preprocess(img, max_wh_ratio):
        """resize_norm_img（对应 ocrRecPreprocess）：BGR、/255、-0.5/0.5、右零填充。"""
        bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        h, w = bgr.shape[:2]
        img_w = int(np.floor(REC_H * max_wh_ratio))
        resized_w = int(np.ceil(REC_H * (w / h)))
        if resized_w > img_w:
            resized_w = img_w
        resized = cv2.resize(bgr, (resized_w, REC_H), interpolation=cv2.INTER_LINEAR)
        blob = resized.astype(np.float32) / 255.0
        blob = (blob - 0.5) / 0.5
        blob = blob.transpose(2, 0, 1)
        padded = np.zeros((3, REC_H, img_w), dtype=np.float32)
        padded[:, :, :resized_w] = blob
        return np.ascontiguousarray(padded[None], dtype=np.float32)

    def _ctc_decode(self, preds):
        """CTC 去重 + 去 blank 解码（对应 ocrRecCTCDecode）。"""
        # preds: [1, seqLen, vocab]
        seq = preds[0]
        idx = seq.argmax(axis=1)
        prob = seq.max(axis=1)
        text, confs = [], []
        prev = -1
        for i, p in zip(idx, prob):
            i = int(i)
            if i == 0:  # blank
                prev = 0
                continue
            if i != prev:
                if i < len(self.char_dict):
                    text.append(self.char_dict[i])
                    confs.append(float(p))
            prev = i
        score = float(np.mean(confs)) if confs else 0.0
        return "".join(text), score


class OCR:
    """检测 + 识别的完整 OCR（对应 main.go 的 runOCR）。"""

    def __init__(self, model_dir: str):
        self.detector = TextDetector(os.path.join(model_dir, "det.ort"))
        self.recognizer = TextRecognizer(
            os.path.join(model_dir, "rec.ort"), os.path.join(model_dir, "ocr.res")
        )

    def __call__(self, img: np.ndarray):
        """输入 RGB HWC 页面图，返回按阅读顺序排列的 [{"text","score","quad"}]。"""
        boxes = self.detector(img)
        lines = []
        for box in boxes:
            crop = _crop_quad(img, box)
            if crop is None:
                continue
            text, score = self.recognizer(crop)
            if text.strip():
                lines.append({"text": text, "score": score, "quad": box})

        # 从上到下、从左到右排阅读顺序（对应 main.go 的排序）
        lines.sort(key=lambda l: (l["quad"][:, 1].min(), l["quad"][:, 0].min()))
        return lines


def _crop_quad(img: np.ndarray, quad: np.ndarray):
    """用四边形框的轴对齐包围盒裁剪子图（对应 main.go 的 cropQuad）。"""
    x0 = int(np.floor(quad[:, 0].min()))
    y0 = int(np.floor(quad[:, 1].min()))
    x1 = int(np.ceil(quad[:, 0].max()))
    y1 = int(np.ceil(quad[:, 1].max()))
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(img.shape[1], x1)
    y1 = min(img.shape[0], y1)
    if x1 <= x0 or y1 <= y0:
        return None
    return img[y0:y1, x0:x1]
