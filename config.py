import os
from dotenv import load_dotenv

# 加载项目根目录下的 .env 文件
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat").strip()

# env 里的值默认是字符串，这里统一转成 int
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "400"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
RETRIEVAL_TOP_K = int(os.getenv("RETRIEVAL_TOP_K", "4"))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DOCUMENTS_DIR = os.path.join(DATA_DIR, "documents")
SESSIONS_DIR = os.path.join(DATA_DIR, "sessions")
CHUNKS_DIR = os.path.join(DATA_DIR, "chunks")

for _dir in (DATA_DIR, DOCUMENTS_DIR, SESSIONS_DIR, CHUNKS_DIR):
    os.makedirs(_dir, exist_ok=True)
