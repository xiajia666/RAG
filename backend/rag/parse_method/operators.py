"""图像预处理与通用几何算子。

对应参考实现 native/geometry.go、nms.go、dla_preprocess.go、tsr_decode.go。
Go 里手写的 cv2 等价物（双线性缩放、letterbox、NMS）在这里直接用 OpenCV / numpy 实现。
"""
import cv2
import numpy as np


def resize(img: np.ndarray, width: int, height: int) -> np.ndarray:
    """与 cv2.INTER_LINEAR 一致的双线性缩放。"""
    return cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)


def letterbox(img: np.ndarray, size: int = 1024, fill: int = 114):
    """等比缩放 + 居中填充到 size×size（对应 dlaLetterbox）。

    输入 RGB HWC，输出 CHW float32（/255，RGB），并返回 (dw, dh, new_w, new_h)
    供后处理把模型坐标映射回原图。
    """
    h, w = img.shape[:2]
    r = min(size / h, size / w)
    new_w = int(round(w * r))
    new_h = int(round(h * r))
    dw = (size - new_w) / 2.0
    dh = (size - new_h) / 2.0

    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    top = int(round(dh - 0.1))
    left = int(round(dw - 0.1))

    canvas = np.full((size, size, 3), fill, dtype=np.uint8)
    canvas[top:top + new_h, left:left + new_w] = resized
    blob = canvas.astype(np.float32) / 255.0
    blob = blob.transpose(2, 0, 1)  # CHW，RGB
    return np.ascontiguousarray(blob), dw, dh, new_w, new_h


def nms(boxes: np.ndarray, scores: np.ndarray, iou_thr: float, plus_one: bool = False):
    """按分数降序的 NMS，返回保留框的索引（对应 nms.go）。

    plus_one 为 True 时在宽高上 +1（DLA 用 +1，TSR 不用），与 operators.py 一致。
    """
    order = scores.argsort()[::-1]
    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    keep = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(boxes[i, 0], boxes[rest, 0])
        yy1 = np.maximum(boxes[i, 1], boxes[rest, 1])
        xx2 = np.minimum(boxes[i, 2], boxes[rest, 2])
        yy2 = np.minimum(boxes[i, 3], boxes[rest, 3])
        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        if plus_one:
            w = w + 1.0
            h = h + 1.0
        inter = w * h
        union = areas[i] + areas[rest] - inter
        iou = np.where(union > 0, inter / union, 0.0)
        order = rest[iou <= iou_thr]
    return keep
