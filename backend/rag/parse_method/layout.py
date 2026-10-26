"""DLA 版面分析（YOLOv10）。

对应参考实现 native/dla.go、dla_preprocess.go。识别标题、正文、引用、图片、表格等区域。
"""
import cv2
import numpy as np

from .operators import letterbox, nms
from .session import run

INPUT_SIZE = 1024
MAX_BOXES = 300
SCORE_THR = 0.08
NMS_IOU = 0.45

# 与 Go yoloDlaLabels 一一对应（下标即模型输出的 class id，注意 4/7/9 重复）。
LABELS = ["title", "Text", "Reference", "Figure", "Figure caption",
          "Table", "Table caption", "Table caption", "Equation", "Figure caption"]

# 与 Go dlaClassMap 对应（lowercased 标签 → 对外 class id）。
CLASS_MAP = {
    "title": 0, "text": 1, "reference": 2, "figure": 3,
    "figure caption": 4, "table": 5, "table caption": 6, "equation": 8,
}


class LayoutRecognizer:
    def __init__(self, model_path: str):
        self.model_path = model_path

    def __call__(self, img: np.ndarray):
        """输入 RGB HWC 页面图，返回 [{"cls","score","bbox"}]（bbox 为 x0,y0,x1,y1）。"""
        h, w = img.shape[:2]
        blob, dw, dh, new_w, new_h = letterbox(img, INPUT_SIZE, 114)
        out = np.asarray(run(self.model_path, "images", "output0", blob[None]), dtype=np.float32)
        preds = out.reshape(-1, 6)
        scale_w = w / new_w
        scale_h = h / new_h

        cands = []  # (cls, score, x0, y0, x1, y1)
        for row in preds[:MAX_BOXES]:
            score = float(row[4])
            if score <= SCORE_THR:
                continue
            cls = int(row[5])  # 截断，与 Go int(out[base+5]) 一致
            if cls < 0 or cls >= len(LABELS):
                continue
            x0 = (float(row[0]) - dw) * scale_w
            y0 = (float(row[1]) - dh) * scale_h
            x1 = (float(row[2]) - dw) * scale_w
            y1 = (float(row[3]) - dh) * scale_h
            cands.append((cls, score, x0, y0, x1, y1))

        # 按类 NMS（iou=0.45, +1）
        by_cls = {}
        for i, c in enumerate(cands):
            by_cls.setdefault(c[0], []).append(i)

        results = []
        for cls, idxs in by_cls.items():
            boxes = np.array([cands[i][2:6] for i in idxs], dtype=np.float32)
            scores = np.array([cands[i][1] for i in idxs], dtype=np.float32)
            for k in nms(boxes, scores, NMS_IOU, plus_one=True):
                _, score, x0, y0, x1, y1 = cands[idxs[k]]
                mapped = CLASS_MAP.get(LABELS[cls].lower())
                if mapped is None:
                    continue
                results.append({
                    "cls": mapped,
                    "score": round(score, 4),
                    "bbox": (round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)),
                })

        # 确定性排序（与 Go 末尾排序一致）
        results.sort(key=lambda b: (b["cls"], b["bbox"][0], b["bbox"][1],
                                    b["bbox"][2], b["bbox"][3], b["score"]))
        return results
