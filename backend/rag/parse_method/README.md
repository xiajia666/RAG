# DeepDoc 深度文档解析（parse_method）

RagFlow「DeepDoc」深度文档解析的 Python 移植：用 `onnxruntime + numpy + OpenCV + pyclipper`
在 Python 里跑 4 个 ONNX 模型，把扫描型 / 图片型 PDF 还原成带结构、可检索的文本。

## 目录结构

```
backend/rag/
├── parse_model/            # 模型权重（体积较大，已 gitignore）
│   ├── layout.ort
│   ├── det.ort
│   ├── rec.ort
│   ├── tsr.ort
│   └── ocr.res
└── parse_method/           # 解析代码（本目录）
    ├── session.py          # ONNX Runtime 会话缓存
    ├── operators.py        # 图像预处理 / NMS
    ├── postprocess.py      # DBNet 后处理（unclip / minAreaRect / box_score）
    ├── ocr.py              # 文字检测（det）+ 文字识别（rec）
    ├── layout.py           # 版面分析（layout）
    ├── tsr.py              # 表格结构识别（tsr）
    └── pdf_parser.py       # PDF 渲染 → 跑模型 → 合并成 markdown
```

## 模型说明

| 文件 | 模型类型 | 大小 | 作用 |
|---|---|---|---|
| `layout.ort` | YOLOv10 目标检测 | 76MB | **版面分析**：找出标题/正文/表格/图片等区域 |
| `det.ort` | DBNet 分割式检测 | 4.9MB | **文字检测**：找出每行文字的位置（四边形框） |
| `rec.ort` | CRNN + CTC 识别 | 11MB | **文字识别**：把检测出的文字行图像识别成文本 |
| `tsr.ort` | PP-Det 检测 | 12MB | **表格结构识别**：找出表格的行/列/表头/单元格 |
| `ocr.res` | （不是模型）词典 | 26KB | `rec.ort` 的字符表，把输出索引映射回文字 |

### 1. `layout.ort` — 版面分析（DLA，YOLOv10）

- 输入 `images [1,3,1024,1024]`，输出 `output0 [1,300,6]`（最多 300 个候选框，每框
  6 个值 = x0,y0,x1,y1,置信度,类别）。
- 把整页等比缩放 + 居中填充到 1024×1024，输出页面各区域的位置和类别。类别共 10 个
  下标（4/7/9 为重复项）：`title / text / reference / figure / figure caption / table /
  table caption / equation`。
- **作用**：宏观判断「这页哪里有标题、哪里有正文、哪里是表格、哪里是图片」，是整条
  流水线的「总导演」。

### 2. `det.ort` — 文字检测（DBNet）

- 输入 `x [1,3,H,W]`（可变尺寸：最长边限 960、取 32 倍数），输出
  `sigmoid_0.tmp_0 [1,1,H,W]`（每个像素是「文字」的概率图）。
- DBNet 是分割式检测：概率图 → 阈值 0.3 二值化 → 找连通域轮廓 → `minAreaRect` 取最小
  外接矩形 → 按 1.5 倍外扩（unclip）得到贴合文字的四边形容器。
- **作用**：回答「文字在哪里」，给每行文字一个四边形坐标。它只定位、不识字。

### 3. `rec.ort` — 文字识别（CRNN + CTC）

- 输入 `x [1,3,48,W]`（把 `det.ort` 裁出的文字行统一缩放到高 48、宽度可变），输出
  `softmax_11.tmp_0 [1,seqLen,6625]`（每个时间步对 6625 个字符的概率分布）。
- CRNN = CNN 提特征 + 序列建模 + CTC 解码；输出 6625 类正好对应 `ocr.res` 的词典。
- **作用**：回答「这行文字写的是什么」，把行图像转成字符串 + 置信度。

### 4. `tsr.ort` — 表格结构识别（PP-Det）

- 输入 `images [1,3,640,640]`（把表格区域裁出来缩放到 640×640），输出
  `output0 [1,11,8400]`（8400 个锚点 × 11 个特征：中心点 x,y,w,h + 7 个类别分数）。
- 识别 6 类结构元素：`table / table column / table row / table column header /
  table projected row header / table spanning cell`。
- **作用**：回答「表格长什么样」——哪几列、哪几行、哪些是表头、哪些单元格跨行跨列，
  配合 OCR 的文字即可重建 markdown 表格。

### 5. `ocr.res` — 字符词典

- 6623 行字符。`rec.ort` 输出的是数字索引，靠它把索引还原成文字：
  `索引0=blank，1~6623=字符，6624=空格`。没有它，`rec.ort` 只能输出一串没意义的数字。

## 处理流程

```
PDF 页 ──渲染(216 DPI)──► 图像
   │
   ├─ layout.ort ──► 版面区域（标题/正文/表格/图片位置）
   │
   ├─ det.ort ──► 文字行框（每行文字的四边形）
   │     └─ rec.ort + ocr.res ──► 每行文字内容 + 置信度
   │
   └─ 对每个「表格」区域 ──► tsr.ort ──► 行/列/表头结构
                │
                └─ 与 OCR 文字合并 ──► markdown 表格
```

一句话总结：**layout 定格局、det 找字、rec 识字、tsr 拆表**，四者串起来就是把
「扫描/图片型 PDF」还原成带结构、可检索的文本——正是 `pdf_parser.py` 里
`parse_image` 的调用顺序。

## 使用

```python
from rag.parse_method import parse_pdf

text = parse_pdf(pdf_bytes, model_dir="/path/to/parse_model")  # 返回 markdown 文本
```

- 模型目录默认由 `core/config.py` 的 `DEEP_DOC_MODEL_DIR` 决定（默认
  `backend/rag/parse_model`）。
- 上传 PDF 时是否走 DeepDoc 由 `DEEP_DOC_ENABLED` 控制（默认 `false`，关闭则回退到
  `pypdf` 文本层抽取）；开启需保证已安装
  `onnxruntime / opencv-python-headless / pyclipper / PyMuPDF`（见 `requirements.txt`）。
- 注意：逐页跑 4 个模型较慢（单页约 2 秒、含表格更久），大 PDF 建议按需开启。
