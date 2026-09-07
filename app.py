"""FastAPI 后端：文档上传 + 向量检索 + 流式问答。"""
import json
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import config
import llm
import parsing
import storage
import vector_store

app = FastAPI(title="文档问答 RAG")

SYSTEM_PROMPT_TEMPLATE = """你是一个文档问答助手，请严格根据下面提供的「文档内容」回答用户的问题。

要求：
1. 只使用「文档内容」里的信息回答，不要编造或补充。
2. 如果文档内容不足以回答，请直接说明"文档中没有找到相关信息"。
3. 用简洁、清晰的中文回答。

文档内容：
{context}
"""


class SessionCreate(BaseModel):
    title: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def build_messages(history, query, results):
    """把检索到的文档上下文 + 历史消息拼成发给 LLM 的消息列表。"""
    if results:
        context = "\n\n---\n\n".join(
            f"[{i + 1}] 来源：{r['filename']}\n{r['content']}"
            for i, r in enumerate(results)
        )
    else:
        context = "（没有检索到相关文档内容）"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_TEMPLATE.format(context=context)}
    ]

    # 最近的历史消息（限制条数，避免上下文过长）
    for m in history[-12:]:
        role = m.get("role")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": query})
    return messages


# ---------- 页面 ----------

@app.get("/")
async def index():
    return FileResponse(os.path.join(config.BASE_DIR, "static", "index.html"))


# ---------- 会话 ----------

@app.get("/api/session")
async def list_sessions():
    return storage.list_sessions()


@app.post("/api/session")
async def create_session(req: SessionCreate):
    title = (req.title or "").strip() or None
    return storage.create_session(title)


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    s = storage.get_session(session_id)
    if not s:
        raise HTTPException(404, "会话不存在")
    return s


@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    if not storage.delete_session(session_id):
        raise HTTPException(404, "会话不存在")
    return {"deleted": True}


# ---------- 文档 ----------

@app.get("/api/documents")
async def list_documents():
    return storage.list_documents()


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    filename = os.path.basename((file.filename or "unnamed").replace("\\", "/"))
    data = await file.read()
    if not data:
        raise HTTPException(400, "文件为空")

    try:
        text = parsing.extract_text(filename, data)
    except Exception as e:
        raise HTTPException(400, f"解析文件失败：{e}")

    text = (text or "").strip()
    if not text:
        raise HTTPException(400, "未能从文件中提取到文本（可能是扫描版 PDF）")

    # 1. 保存文档元数据 + 原始文件
    doc = storage.add_document(filename, len(data))
    original_path = os.path.join(config.DOCUMENTS_DIR, f"{doc['id']}_{filename}")
    with open(original_path, "wb") as f:
        f.write(data)

    # 2. 分块 + 建立索引
    chunk_count = vector_store.index_document(doc["id"], filename, text)

    return {"document": storage.get_document(doc["id"]), "chunk_count": chunk_count}


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str):
    if not storage.delete_document(doc_id):
        raise HTTPException(404, "文档不存在")
    return {"deleted": True}


# ---------- 对话（SSE 流式） ----------

@app.post("/api/chat/stream")
def chat_stream(req: ChatRequest):
    query = req.message.strip()
    session_id = (req.session_id or "").strip()

    if not query:
        raise HTTPException(400, "消息为空")

    # 未传 session_id 或 session 不存在 -> 自动创建
    if not session_id or not storage.get_session(session_id):
        session = storage.create_session()
        session_id = session["id"]

    def generate():
        session = storage.get_session(session_id)
        history = session.get("messages", []) if session else []

        results = vector_store.search(query)
        messages = build_messages(history, query, results)

        # 先发 meta：会话 id + 检索来源
        yield sse_event({
            "type": "meta",
            "session_id": session_id,
            "sources": [
                {"filename": r["filename"], "score": round(r["score"], 4)}
                for r in results
            ],
        })

        full_answer = ""
        try:
            for token in llm.chat_stream(messages):
                full_answer += token
                yield sse_event({"type": "content", "text": token})
        except Exception as e:
            yield sse_event({"type": "error", "message": str(e)})

        # 流结束后保存本轮问答
        session = storage.get_session(session_id)
        if session:
            session.setdefault("messages", [])
            session["messages"].append({"role": "user", "content": query})
            if full_answer:
                session["messages"].append({"role": "assistant", "content": full_answer})
            storage.save_session(session)

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
