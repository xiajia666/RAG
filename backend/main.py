import os

from dotenv import load_dotenv

# 先加载项目根目录的 .env，这样 HOST / PORT / RELOAD 才能从中读取
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

import uvicorn

from app import app  # 导入 FastAPI 应用实例

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "80"))
RELOAD = os.getenv("RELOAD", "false").lower() in ("1", "true", "yes")

if __name__ == "__main__":
    # reload=True 需要传 import string（uvicorn 会 fork 子进程重新 import）
    if RELOAD:
        uvicorn.run("app:app", host=HOST, port=PORT, reload=True)
    else:
        uvicorn.run(app, host=HOST, port=PORT)
