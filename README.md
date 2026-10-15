# 小微企业 RAG 知识库

专精于小微企业的多知识库 RAG 问答系统：**React 前端 + FastAPI 后端**，支持多知识库隔离、云端 Embedding 语义检索、多用户登录、流式问答。

## 功能特性

- **多知识库**：按业务场景拆分（合同 / 财务 / 产品手册 / 售后话术 / 政策…），各库独立上传文档、独立检索问答。
- **语义检索**：上传后自动解析、按字符分块并保留重叠上下文，调用云端 Embedding 后分批写入 Qdrant；查询只编码 query，并由 Qdrant 完成余弦相似度检索。
- **企业多租户**：用户、知识库、文档和会话按租户隔离；知识库可设为企业共享或指定成员访问。
- **团队权限**：管理员、编辑、只读三种企业角色；管理员可以为每个知识库再指定编辑/只读成员。
- **产品工作台**：仪表盘、知识库向导、智能问答、文档管理、数据分析、团队管理和设置均接入后端数据。
- **多用户登录**：bcrypt + JWT，首个注册用户自动成为管理员；团队邀请生成初始密码，当前版本尚未接入邮件投递。
- **流式问答**：SSE 流式输出，回答附带来源文档与相关度分数。
- **数据隔离**：业务记录始终按 `tenant_id` 查询；MySQL 可用于远程部署，上传文件保存在应用服务器的租户独立目录。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.11 · FastAPI · SQLAlchemy（MySQL / SQLite）· Qdrant · numpy · DeepSeek（问答）· 云端 Embedding（检索） |
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS 4 · react-router · react-markdown |

## 目录结构

```
RAG/
├── backend/          # Python + FastAPI 后端
│   ├── app.py        # API 路由
│   ├── main.py       # uvicorn 入口
│   ├── requirements.txt
│   └── data/         # SQLite、上传文件和 JWT 密钥
├── frontend/         # React + TypeScript 前端（Vite）
│   ├── src/workspace-pages/ # 产品工作台页面
├── .env              # 本地服务配置
└── README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
pip install -r backend/requirements.txt
```

前端构建要求 Node.js 20.19 或更新版本；服务器建议使用 Node.js 20 LTS。

### 2. 配置 `.env`

可复制项目根目录的 `.env.example` 为 `.env`，然后填写实际配置：

```env
# 问答模型（DeepSeek，OpenAI 兼容协议）
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# 检索向量（DeepSeek 无 embedding 接口，需另配供应商）
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_MODEL=BAAI/bge-m3

# Qdrant HTTP 服务；启用认证时填写与服务端一致的 API Key
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=rag_chunks
QDRANT_TIMEOUT=30
QDRANT_BATCH_SIZE=64

# 字符数（不是 token 数），须满足 0 <= CHUNK_OVERLAP < CHUNK_SIZE
CHUNK_SIZE=400
CHUNK_OVERLAP=100

# JWT 密钥（留空则自动生成并持久化到 backend/data/.jwt_secret）
JWT_SECRET=

# 服务端口
PORT=8000
```

**Embedding 供应商**：默认推荐 [硅基流动 SiliconFlow](https://siliconflow.cn) 的 `BAAI/bge-m3`（便宜、中文好、注册送额度）。任意 OpenAI 兼容的 embedding 服务均可，改 `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` 即可，代码零改动。备选：智谱 `embedding-3`、阿里 `text-embedding-v3`。

### 3. 启动后端

先启动 Qdrant。本地开发示例（需要 Docker，数据保存在命名卷中）：

```bash
docker run -d --name rag-qdrant --restart unless-stopped \
  -p 127.0.0.1:6333:6333 \
  -v rag_qdrant_data:/qdrant/storage \
  qdrant/qdrant:latest
```

也可连接已有 Qdrant（服务端需 1.12 或更新版本），将 `QDRANT_URL` 和 `QDRANT_API_KEY` 指向该实例。首次上传自动按 Embedding 返回的维度创建集合及过滤字段索引；已存在的集合必须使用相同维度和 Cosine 距离，否则上传会明确报错。连接容器或远程服务时，URL 应使用后端能访问的服务地址。

```bash
python backend/main.py  # 生产模式，同时服务 API 与前端产物
# 或开发模式：
uvicorn app:app --reload --port 8000 --app-dir backend
```

MySQL 初始化和历史租户迁移 SQL 已集中在 `backend/mysql_all.sql`。新部署只需执行文件中的“新库初始化”部分；已经完成租户迁移的现有数据库无需重跑历史迁移部分。执行前，将初始化部分两处 `REPLACE_WITH_A_LONG_RANDOM_PASSWORD` 换成同一个强密码。然后把以下设置追加到项目根目录 `.env`，并填同一应用密码和服务器提供的可信 CA PEM 路径：

```env
DATABASE_BACKEND=mysql
MYSQL_HOST=123.57.80.38
MYSQL_PORT=3306
MYSQL_DATABASE=rag_db
MYSQL_USER=rag_app
MYSQL_PASSWORD=替换为你设置的应用密码
MYSQL_SSL=true
MYSQL_SSL_VERIFY=true
MYSQL_SSL_CA=/path/to/mysql-ca.pem
```

应用账号要求 TLS；建议将 SQL 中的 `'rag_app'@'%'` 限制为后端服务器的固定来源 IP。

### 4. 前端（开发 / 构建）

```bash
cd frontend
npm install
npm run dev            # 开发：http://localhost:5173（自动代理 /api 到 8000）
npm run build          # 构建到 frontend/dist，由后端静态托管
```

构建后直接访问 `http://localhost:8000` 即为完整应用（前端 + API 同源）。

## 使用流程

1. 打开应用 → 注册首个账号（自动成为**管理员**）。
2. 管理员新建知识库（如「员工手册」）。
3. 在「文档管理」中上传 PDF / DOCX / txt / md 等文档（自动解析、分块、向量化并写入 Qdrant，完成后才返回成功）。扫描版 PDF 需先进行 OCR。
4. 在知识库内直接提问，回答会附带来源文档与相关度。
5. 管理员在「用户管理」中为员工创建账号（角色：成员）。

## 权限模型

| 角色 | 权限 |
|---|---|
| 管理员 admin | 管理知识库、文档、用户；删除任意会话 |
| 编辑 operator | 访问企业共享或已授权知识库、上传文档、管理自己的会话 |
| 只读 user | 访问企业共享或已授权知识库并问答，不能上传文档 |

知识库默认企业内共享。管理员可在知识库详情中切换为指定成员访问，并分别授予编辑或只读权限。会话按用户隔离。

## 文档索引与存储

- 原始文件保存在 `backend/data/documents/<tenant_id>/`，SQL 保留文档记录和切片文本，供列表、下载、切片预览使用。新增切片的 `embedding` SQL 字段留空，兼容原有表结构，无需修改现有表。
- 每个 Qdrant point 保存向量，以及 `tenant_id`、`kb_id`、`doc_id`、`filename`、`chunk_index`、`content`、`created_at`、`embedding_model`。检索按租户、知识库和模型过滤，再核对已提交的 SQL 切片。
- Qdrant 批次写入使用 `wait=True`，完成后在同一 SQL 事务中保存切片和数量。失败时回滚 SQL、清理原文件并尝试删除已写入的向量；如果 Qdrant 同时不可用，清理错误会记录日志，残留向量不会被查询返回。恢复服务后可按日志中的租户、知识库和文档 ID 清理残留点。
- 单篇、批量和整库删除都会先清理对应 Qdrant 索引，向量服务失败时返回 503，保留尚未删除的业务记录供重试。

### 已有 SQL 文档迁移 / 索引重建

旧版本存于 SQL 的向量不会自动出现在 Qdrant 中。配置好 Embedding 和 Qdrant 后，在项目根目录执行：

```bash
python backend/reindex_qdrant.py --tenant-id <租户ID>
# 也可只重建一个知识库：
python backend/reindex_qdrant.py --tenant-id <租户ID> --kb-id <知识库ID>
```

脚本使用已保存的切片文本重新调用 Embedding（会产生供应商费用），保留原文档、切片 ID、预览和会话。相同 point ID 会被覆盖，失败后可重跑。切换模型时建议使用新的 `QDRANT_COLLECTION` 并对所有需要查询的租户重建索引；修改分块参数仅对新上传文档生效。

## 后端测试

```bash
pip install -r backend/requirements-dev.txt
python -m pytest backend/tests -q
```

测试使用临时 SQLite、Qdrant 客户端的本地内存引擎和模拟 Embedding 响应，不依赖在线模型或生产数据库，覆盖上传分块、检索隔离、删除、迁移和失败补偿。Qdrant 接口用法参考[官方 Points 文档](https://qdrant.tech/documentation/manage-data/points/)和[多租户过滤文档](https://qdrant.tech/documentation/tutorials/multiple-partitions/)。

## 常见问题

- **上传报「EMBEDDING_API_KEY 未配置」**：`.env` 中未填向量供应商的 key（DeepSeek 不提供 embedding）。
- **无法连接 Qdrant / 401**：检查 `QDRANT_URL` 是否为 HTTP API 地址（通常端口 6333），以及 `QDRANT_API_KEY` 是否与服务端一致。
- **想换检索供应商**：修改 `EMBEDDING_*`、配置新的 `QDRANT_COLLECTION`，再运行上面的重建脚本，无需删除业务数据库。
- **端口**：生产可改回 80（需 root）；本地开发建议 8000。
