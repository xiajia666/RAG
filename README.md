# 小微企业 RAG 知识库

专精于小微企业的多知识库 RAG 问答系统：**React 前端 + FastAPI 后端**，支持多知识库隔离、云端 Embedding 语义检索、多用户登录、流式问答。

## 功能特性

- **多知识库**：按业务场景拆分（合同 / 财务 / 产品手册 / 售后话术 / 政策…），各库独立上传文档、独立检索问答。
- **语义检索**：云端 Embedding 向量检索（非关键词匹配），上传时批量编码入库，查询只编码 query。
- **多用户登录**：bcrypt + JWT，首个注册用户自动成为管理员；管理员可管理知识库、文档、用户。
- **流式问答**：SSE 流式输出，回答附带来源文档与相关度分数。
- **数据私有**：全部数据落本地 SQLite 单文件 + 本地文件系统，无第三方数据依赖。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python 3.11 · FastAPI · MySQL / SQLite · numpy · DeepSeek（问答）· 云端 Embedding（检索） |
| 前端 | React 18 · TypeScript · Vite · react-router · react-markdown |

## 目录结构

```
RAG/
├── backend/          # Python + FastAPI 后端
│   ├── app.py        # API 路由
│   ├── main.py       # uvicorn 入口
│   ├── requirements.txt
│   └── data/         # SQLite、上传文件和 JWT 密钥
├── frontend/         # React + TypeScript 前端（Vite）
│   └── ui-reference/ # 独立的 UI 设计参考
├── .env              # 本地服务配置
└── README.md
```

## 快速开始

### 1. 安装后端依赖

```bash
pip install -r backend/requirements.txt
```

> 若缺少系统 Node，前端构建需要先装 Node：`brew install node`

### 2. 配置 `.env`

```env
# 问答模型（DeepSeek，OpenAI 兼容协议）
DEEPSEEK_API_KEY=sk-xxx
DEEPSEEK_MODEL=deepseek-chat

# 检索向量（DeepSeek 无 embedding 接口，需另配供应商）
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_API_KEY=sk-xxx
EMBEDDING_MODEL=BAAI/bge-m3

# JWT 密钥（留空则自动生成并持久化到 backend/data/.jwt_secret）
JWT_SECRET=

# 服务端口
PORT=8000
```

**Embedding 供应商**：默认推荐 [硅基流动 SiliconFlow](https://siliconflow.cn) 的 `BAAI/bge-m3`（便宜、中文好、注册送额度）。任意 OpenAI 兼容的 embedding 服务均可，改 `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` / `EMBEDDING_API_KEY` 即可，代码零改动。备选：智谱 `embedding-3`、阿里 `text-embedding-v3`。

### 3. 启动后端

```bash
python backend/main.py  # 生产模式，同时服务 API 与前端产物
# 或开发模式：
uvicorn app:app --reload --port 8000 --app-dir backend
```

也可以在 MySQL 管理端执行 `backend/mysql_init.sql`。执行前，将 SQL 中两处 `REPLACE_WITH_A_LONG_RANDOM_PASSWORD` 换成同一个强密码。然后把以下设置追加到项目根目录 `.env`，并填同一应用密码和服务器提供的可信 CA PEM 路径：

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
3. 在「文档管理」中上传 PDF / Word / txt / md 等文档（自动解析、分块、向量化）。
4. 在知识库内直接提问，回答会附带来源文档与相关度。
5. 管理员在「用户管理」中为员工创建账号（角色：成员）。

## 权限模型

| 角色 | 权限 |
|---|---|
| 管理员 admin | 管理知识库、文档、用户；删除任意会话 |
| 成员 user | 在知识库内问答、上传文档、管理自己的会话 |

知识库为组织共享，会话按用户隔离。

## 常见问题

- **上传报「EMBEDDING_API_KEY 未配置」**：`.env` 中未填向量供应商的 key（DeepSeek 不提供 embedding）。
- **想换检索供应商**：改 `.env` 里 `EMBEDDING_*` 三项即可；换模型后需删除 `backend/data/app.db` 重新上传文档以重建向量。
- **端口**：生产可改回 80（需 root）；本地开发建议 8000。
