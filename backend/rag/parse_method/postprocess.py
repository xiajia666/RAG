"""DB 文本检测后处理。

对应参考实现 native/det_core.go、det_helpers.go（亦即 deepdoc/vision/postprocess.py 的
DBPostProcess）。Go 里手写的 findContours / minAreaRect / fillPoly / unclip 在这里用
cv2 + pyclipper 等价实现。
"""
import cv2
import numpy as np
import pyclipper


def polygon_area(points: np.ndarray) -> float:
    """鞋带公式求多边形面积（对应 polygonArea）。"""
    x = points[:, 0]
    y = points[:, 1]
    return 0.5 * np.abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def polygon_length(points: np.ndarray) -> float:
    """多边形周长（对应 polygonPerimeter）。"""
    dx = np.roll(points[:, 0], -1) - points[:, 0]
    dy = np.roll(points[:, 1], -1) - points[:, 1]
    return float(np.sum(np.hypot(dx, dy)))


class DBPostProcess:
    """DBNet 输出概率图 → 文本框（对应 detBoxThresh=0.5 / detThresh=0.3）。"""

    def __init__(self, thresh=0.3, box_thresh=0.5, max_candidates=1000,
                 unclip_ratio=1.5, min_size=3):
        self.thresh = thresh
        self.box_thresh = box_thresh
        self.max_candidates = max_candidates
        self.unclip_ratio = unclip_ratio
        self.min_size = min_size

    def __call__(self, pred, dest_width, dest_height):
        """pred: [H, W] 概率图（已 sigmoid）。返回 (boxes[N,4,2], scores[N])。"""
        bitmap = (pred > self.thresh).astype(np.uint8)
        contours, _ = cv2.findContours(bitmap, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        num_contours = min(len(contours), self.max_candidates)

        boxes, scores = [], []
        for index in range(num_contours):
            contour = contours[index]
            points, sside = self._get_mini_boxes(contour)
            if sside < self.min_size:
                continue
            points = np.array(points, dtype=np.float32)
            score = self._box_score_fast(pred, points)
            if self.box_thresh > score:
                continue
            box = self.unclip(points).reshape(-1, 1, 2)
            box, sside = self._get_mini_boxes(box)
            if sside < self.min_size + 2:
                continue
            box = np.array(box, dtype=np.float32)
            box[:, 0] = np.clip(np.round(box[:, 0] / bitmap.shape[1] * dest_width), 0, dest_width)
            box[:, 1] = np.clip(np.round(box[:, 1] / bitmap.shape[0] * dest_height), 0, dest_height)
            boxes.append(box.astype(np.int16))
            scores.append(score)

        if not boxes:
            return np.zeros((0, 4, 2), dtype=np.int16), []
        return np.array(boxes, dtype=np.int16), scores

    def unclip(self, box: np.ndarray) -> np.ndarray:
        """按 area * ratio / length 外扩四边形（对应 unclip / clipper_offset.go）。"""
        distance = polygon_area(box) * self.unclip_ratio / polygon_length(box)
        offset = pyclipper.PyclipperOffset()
        # 参考实现把 float 四边形截断为 int64 再送入 Clipper（JT_ROUND）
        offset.AddPath(box.astype(np.int64).tolist(), pyclipper.JT_ROUND,
                       pyclipper.ET_CLOSEDPOLYGON)
        expanded = offset.Execute(distance)
        return np.array(expanded, dtype=np.float32)

    @staticmethod
    def _get_mini_boxes(contour):
        """cv2.minAreaRect + boxPoints，再按 x 排序得到顺时针四点（对应 getMiniBoxes）。"""
        bounding_box = cv2.minAreaRect(contour)
        points = sorted(list(cv2.boxPoints(bounding_box)), key=lambda x: x[0])
        if points[1][1] > points[0][1]:
            index_1, index_4 = 0, 1
        else:
            index_1, index_4 = 1, 0
        if points[3][1] > points[2][1]:
            index_2, index_3 = 2, 3
        else:
            index_2, index_3 = 3, 2
        box = [points[index_1], points[index_2], points[index_3], points[index_4]]
        return box, min(bounding_box[1])

    @staticmethod
    def _box_score_fast(bitmap, box):
        """四边形掩码内概率均值（对应 boxScoreFast）。"""
        h, w = bitmap.shape[:2]
        xmin = np.clip(np.floor(box[:, 0].min()).astype(np.int32), 0, w - 1)
        xmax = np.clip(np.ceil(box[:, 0].max()).astype(np.int32), 0, w - 1)
        ymin = np.clip(np.floor(box[:, 1].min()).astype(np.int32), 0, h - 1)
        ymax = np.clip(np.ceil(box[:, 1].max()).astype(np.int32), 0, h - 1)
        mask = np.zeros((ymax - ymin + 1, xmax - xmin + 1), dtype=np.uint8)
        box = box.copy()
        box[:, 0] = box[:, 0] - xmin
        box[:, 1] = box[:, 1] - ymin
        cv2.fillPoly(mask, box.reshape(1, -1, 2).astype(np.int32), 1)
        return cv2.mean(bitmap[ymin:ymax + 1, xmin:xmax + 1], mask)[0]
