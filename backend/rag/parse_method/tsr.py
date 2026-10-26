"""TSR 表格结构识别（PP-Det 风格）。

对应参考实现 native/tsr.go、tsr_decode.go。识别表格的行、列、表头、跨行跨列单元格。
注意通道顺序：TSR 用 BGR（对应 tsrBlob）。
"""
import cv2
import numpy as np

from .operators import nms
from .session import run

INPUT_SIZE = 640
CANDIDATES = 8400
SCORE_THR = 0.2
NMS_IOU = 0.2

LABELS = ["table", "table column", "table row",
          "table column header", "table projected row header", "table spanning cell"]


class TableStructureRecognizer:
    def __init__(self, model_path: str):
        self.model_path = model_path

    def __call__(self, img: np.ndarray):
        """输入 RGB HWC 表格裁剪图，返回 [{"label","score","bbox"}]（bbox 为 x0,top,x1,bottom）。"""
        h, w = img.shape[:2]
        bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        resized = cv2.resize(bgr, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
        blob = resized.astype(np.float32) / 255.0
        blob = np.ascontiguousarray(blob.transpose(2, 0, 1))  # CHW，BGR
        out = np.asarray(run(self.model_path, "images", "output0", blob[None]), dtype=np.float32)
        feats = out.reshape(11, CANDIDATES)  # [1, 11, 8400] → feature-major [11, 8400]
        sf_w = w / INPUT_SIZE
        sf_h = h / INPUT_SIZE

        cands = []  # (cls, score, x0, y0, x1, y1)
        for a in range(CANDIDATES):
            best, best_cls = -1.0, 0
            for c in range(4, 11):
                v = float(feats[c, a])
                if v > best:
                    best, best_cls = v, c - 4
            if best <= SCORE_THR or best_cls >= len(LABELS):
                continue
            cx = float(feats[0, a]) * sf_w
            cy = float(feats[1, a]) * sf_h
            hw = float(feats[2, a]) * sf_w * 0.5
            hh = float(feats[3, a]) * sf_h * 0.5
            cands.append((best_cls, best, cx - hw, cy - hh, cx + hw, cy + hh))

        # 按类 NMS（iou=0.2，无 +1）
        by_cls = {}
        for i, c in enumerate(cands):
            by_cls.setdefault(c[0], []).append(i)

        boxes = []
        for cls, idxs in by_cls.items():
            b = np.array([cands[i][2:6] for i in idxs], dtype=np.float32)
            s = np.array([cands[i][1] for i in idxs], dtype=np.float32)
            for k in nms(b, s, NMS_IOU, plus_one=False):
                _, score, x0, y0, x1, y1 = cands[idxs[k]]
                boxes.append({
                    "label": LABELS[cls],
                    "score": round(score, 4),
                    "bbox": (round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)),
                })

        self._align(boxes)
        boxes.sort(key=lambda x: (LABELS.index(x["label"]), x["bbox"][0], x["bbox"][1],
                                  x["bbox"][2], x["bbox"][3], x["score"]))
        return boxes

    @staticmethod
    def _align(boxes):
        """行/表头贴齐左右边界，列贴齐上下边界（对应 alignTSR）。"""
        left_vals = [b["bbox"][0] for b in boxes if "row" in b["label"] or "header" in b["label"]]
        right_vals = [b["bbox"][2] for b in boxes if "row" in b["label"] or "header" in b["label"]]
        if left_vals:
            left = np.mean(left_vals) if len(left_vals) > 4 else min(left_vals)
            right = np.mean(right_vals) if len(right_vals) > 4 else max(right_vals)
            for b in boxes:
                if "row" in b["label"] or "header" in b["label"]:
                    x0, y0, x1, y1 = b["bbox"]
                    b["bbox"] = (min(x0, left), y0, max(x1, right), y1)

        top_vals = [b["bbox"][1] for b in boxes if b["label"] == "table column"]
        bot_vals = [b["bbox"][3] for b in boxes if b["label"] == "table column"]
        if top_vals:
            top = float(np.median(top_vals)) if len(top_vals) > 4 else min(top_vals)
            bot = float(np.median(bot_vals)) if len(bot_vals) > 4 else max(bot_vals)
            for b in boxes:
                if b["label"] == "table column":
                    x0, y0, x1, y1 = b["bbox"]
                    b["bbox"] = (x0, min(y0, top), x1, max(y1, bot))
