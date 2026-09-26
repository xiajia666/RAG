import os
from dotenv import load_dotenv

# Backend source lives in backend/; keep the shared local configuration at the project root.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

DATA_DIR = os.path.join(BACKEND_DIR, "data")
DOCUMENTS_DIR = os.path.join(DATA_DIR, "documents")   # 原始上传文件
DB_PATH = os.path.join(DATA_DIR, "app.db")            # SQLite 单文件数据库
FRONTEND_DIST = os.path.join(PROJECT_ROOT, "frontend", "dist")

# SQLite remains the local default. Set DATABASE_BACKEND=mysql to use the remote MySQL server.
DATABASE_BACKEND = os.getenv("DATABASE_BACKEND", "sqlite").strip().lower()
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1").strip()
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "rag_db").strip()
MYSQL_USER = os.getenv("MYSQL_USER", "rag_app").strip()
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_SSL = os.getenv("MYSQL_SSL", "false").strip().lower() in ("1", "true", "yes")
MYSQL_SSL_CA = os.getenv("MYSQL_SSL_CA", "").strip()
MYSQL_SSL_VERIFY = os.getenv("MYSQL_SSL_VERIFY", "true").strip().lower() not in ("0", "false", "no")

for _dir in (DATA_DIR, DOCUMENTS_DIR):
    os.makedirs(_dir, exist_ok=True)

# ---------- DeepSeek（LLM 问答） ----------

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()

# ---------- 云端 Embedding（OpenAI 兼容协议） ----------
# DeepSeek 不提供 embedding 接口，需另配供应商（默认硅基流动 BGE-M3）

EMBEDDING_BASE_URL = os.getenv("EMBEDDING_BASE_URL", "https://api.siliconflow.cn/v1").strip()
EMBEDDING_API_KEY = os.getenv("EMBEDDING_API_KEY", "").strip()
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3").strip()
EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))

# ---------- 认证 ----------

def _load_jwt_secret():
    """优先读 .env；否则生成随机密钥并持久化到 data/.jwt_secret，保证重启后 token 仍有效。"""
    secret = os.getenv("JWT_SECRET", "").strip()
    if secret:
        return secret
    secret_file = os.path.join(DATA_DIR, ".jwt_secret")
    if os.path.exists(secret_file):
        with open(secret_file, "r", encoding="utf-8") as f:
            secret = f.read().strip()
        if secret:
            return secret
    secret = os.urandom(32).hex()
    with open(secret_file, "w", encoding="utf-8") as f:
        f.write(secret)
    return secret


JWT_SECRET = _load_jwt_secret()
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))  # 7 天

# ---------- 分块 / 检索 ----------

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "4"))
