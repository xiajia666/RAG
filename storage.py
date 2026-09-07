"""本地存储：会话、文档元数据、分块文本（JSON 文件）。"""
import json
import os
import uuid
from datetime import datetime

import config


# ---------- JSON 工具 ----------

def _load_json(path, default=None):
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return default if default is not None else {}
    return default if default is not None else {}


def _save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ---------- 会话 ----------

def get_session_path(session_id):
    return os.path.join(config.SESSIONS_DIR, f"{session_id}.json")


def create_session(title=None):
    session_id = str(uuid.uuid4())[:8]
    session = {
        "id": session_id,
        "title": title or f"会话 {session_id}",
        "created_at": datetime.now().isoformat(),
        "messages": [],
    }
    _save_json(get_session_path(session_id), session)
    return session


def get_session(session_id):
    return _load_json(get_session_path(session_id), None)


def save_session(session):
    _save_json(get_session_path(session["id"]), session)


def list_sessions():
    sessions = []
    if not os.path.exists(config.SESSIONS_DIR):
        return sessions
    for name in os.listdir(config.SESSIONS_DIR):
        if name.endswith(".json"):
            s = _load_json(os.path.join(config.SESSIONS_DIR, name), None)
            if s:
                sessions.append({
                    "id": s["id"],
                    "title": s["title"],
                    "created_at": s["created_at"],
                    "message_count": len(s.get("messages", [])),
                })
    sessions.sort(key=lambda s: s["created_at"], reverse=True)
    return sessions


def delete_session(session_id):
    path = get_session_path(session_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


# ---------- 文档元数据 ----------

def _documents_index_path():
    return os.path.join(config.DATA_DIR, "documents.json")


def _load_documents_index():
    return _load_json(_documents_index_path(), [])


def _save_documents_index(docs):
    _save_json(_documents_index_path(), docs)


def add_document(filename, size):
    docs = _load_documents_index()
    doc_id = str(uuid.uuid4())[:12]
    doc = {
        "id": doc_id,
        "filename": filename,
        "size": size,
        "created_at": datetime.now().isoformat(),
        "chunk_count": 0,
    }
    docs.append(doc)
    _save_documents_index(docs)
    return doc


def get_document(doc_id):
    for d in _load_documents_index():
        if d["id"] == doc_id:
            return d
    return None


def list_documents():
    docs = _load_documents_index()
    docs.sort(key=lambda d: d["created_at"], reverse=True)
    return docs


def set_document_chunk_count(doc_id, count):
    docs = _load_documents_index()
    for d in docs:
        if d["id"] == doc_id:
            d["chunk_count"] = count
            break
    _save_documents_index(docs)


def delete_document(doc_id):
    docs = _load_documents_index()
    doc = next((d for d in docs if d["id"] == doc_id), None)
    if not doc:
        return False

    _save_documents_index([d for d in docs if d["id"] != doc_id])

    # 删除分块文件
    chunks_path = os.path.join(config.CHUNKS_DIR, f"{doc_id}.json")
    if os.path.exists(chunks_path):
        os.remove(chunks_path)

    # 删除原始上传文件
    original_path = os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{doc['filename']}")
    if os.path.exists(original_path):
        os.remove(original_path)

    return True


# ---------- 分块 ----------

def get_chunks_path(doc_id):
    return os.path.join(config.CHUNKS_DIR, f"{doc_id}.json")


def add_chunks(doc_id, filename, chunks):
    """保存一个文档的所有分块文本。"""
    data = [
        {
            "document_id": doc_id,
            "filename": filename,
            "chunk_index": i,
            "content": text,
        }
        for i, text in enumerate(chunks)
    ]
    _save_json(get_chunks_path(doc_id), data)
    set_document_chunk_count(doc_id, len(data))
    return len(data)


def get_chunks(doc_id):
    return _load_json(get_chunks_path(doc_id), [])


def get_all_chunks():
    """读取所有已建索引的 chunk。"""
    chunks = []
    if not os.path.exists(config.CHUNKS_DIR):
        return chunks
    for name in os.listdir(config.CHUNKS_DIR):
        if name.endswith(".json"):
            chunks.extend(_load_json(os.path.join(config.CHUNKS_DIR, name), []))
    return chunks
