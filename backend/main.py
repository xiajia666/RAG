import os

from dotenv import load_dotenv

# Load project settings before importing the Flask application.
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

from app import app  # WSGI application for Gunicorn and Flask's dev server.

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "80"))
RELOAD = os.getenv("RELOAD", "false").lower() in ("1", "true", "yes")

if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=RELOAD)
