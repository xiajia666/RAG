import os

from dotenv import load_dotenv

# 先加载 .env，这样 PORT 才能从 .env 里读到
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import uvicorn

PORT = int(os.getenv("PORT", "80"))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=PORT, reload=True)
