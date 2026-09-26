"""FastAPI 后端：多知识库 + 云端向量检索 + 多用户 + 流式问答。"""
import json
import os
import re
import unicodedata
import uuid
from datetime import datetime

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

import auth
import config
import db
import llm
import parsing
import vector_store
from schemas import (
    ChatRequest,
    KBRequest,
    LoginRequest,
    RegisterRequest,
    SessionCreate,
    UserCreate,
    UserUpdate,
)

app = FastAPI(title="小微企业 RAG")

SYSTEM_PROMPT_TEMPLATE = """你是一个面向小微企业场景的知识库问答助手，请严格根据下面提供的「知识库内容」回答用户的问题。

要求：
1. 只使用「知识库内容」里的信息回答，不要编造或补充。
2. 如果知识库内容不足以回答，请直接说明"知识库中没有找到相关信息"。
3. 用简洁、清晰的中文回答。

知识库内容：
{context}
"""


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def build_messages(history, query, results):
    """把检索到的知识库上下文 + 历史消息拼成发给 LLM 的消息列表。"""
    if results:
        context = "\n\n---\n\n".join(
            f"[{i + 1}] 来源：{r['filename']}\n{r['content']}"
            for i, r in enumerate(results)
        )
    else:
        context = "（没有检索到相关知识库内容）"

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


def public_user(user_id, tenant_id):
    return db.query_one(
        "SELECT id, tenant_id, username, email, phone, nickname, avatar, role, status, created_at "
        "FROM users WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
        (user_id, tenant_id),
    )


def _normalize_username(value):
    username = unicodedata.normalize("NFKC", value or "").strip().casefold()
    if not username:
        raise HTTPException(400, "用户名不能为空")
    if not 3 <= len(username) <= 32:
        raise HTTPException(400, "用户名长度需为 3 到 32 个字符")
    if any(unicodedata.category(char).startswith("C") for char in username):
        raise HTTPException(400, "用户名不能包含控制字符")
    return username


def _validate_new_password(password):
    if len(password) < 8:
        raise HTTPException(400, "密码至少 8 位")
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(400, "密码不能超过 72 个 UTF-8 字节")


def _normalize_tenant_code(value):
    code = (value or "").strip().lower()
    if not 3 <= len(code) <= 64 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])", code):
        raise HTTPException(400, "租户代码需为 3 到 64 位，仅支持字母、数字和连字符")
    return code


def get_kb_or_404(kb_id, tenant_id):
    kb = db.query_one("SELECT * FROM knowledge_bases WHERE id = ? AND tenant_id = ?", (kb_id, tenant_id))
    if not kb:
        raise HTTPException(404, "知识库不存在")
    return kb


def _original_path(tenant_id, doc_id, filename):
    tenant_dir = os.path.join(config.DOCUMENTS_DIR, tenant_id)
    os.makedirs(tenant_dir, exist_ok=True)
    return os.path.join(tenant_dir, f"{doc_id}_{filename}")


def _remove_original_file(tenant_id, doc_id, filename):
    # Also remove the pre-tenant path used by files uploaded before this migration.
    for path in (
        _original_path(tenant_id, doc_id, filename),
        os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{filename}"),
    ):
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


# ---------- 认证 ----------

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    tenant_name = (req.tenant_name or "").strip()
    if not tenant_name or len(tenant_name) > 128:
        raise HTTPException(400, "企业名称不能为空且不能超过 128 个字符")
    tenant_code = _normalize_tenant_code(req.tenant_code)
    username = _normalize_username(req.username)
    password = req.password or ""
    _validate_new_password(password)

    tenant_id = uuid.uuid4().hex
    user_id = uuid.uuid4().hex
    try:
        db.create_tenant_with_admin(
            tenant_id, tenant_code, tenant_name, user_id, username, auth.hash_password(password)
        )
    except Exception as exc:
        # Tenant codes are unique; do not expose raw SQL errors to clients.
        if getattr(exc, "args", ()) and exc.args[0] in (1062, 19):
            raise HTTPException(409, "租户代码已被使用") from exc
        raise
    return {
        "token": auth.create_token(user_id, tenant_id, 1),
        "tenant_code": tenant_code,
        "user": public_user(user_id, tenant_id),
    }


@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request):
    raw_username = (req.username or "").strip()
    username = unicodedata.normalize("NFKC", raw_username).casefold()
    tenant_code = _normalize_tenant_code(req.tenant_code)
    user = db.query_one(
        "SELECT u.* FROM users u JOIN tenants t ON t.id = u.tenant_id "
        "WHERE t.tenant_code = ? AND t.status = 1 AND u.username = ? "
        "AND u.status = 1 AND u.deleted_at IS NULL",
        (tenant_code, username),
    )
    if not user or not auth.verify_password(req.password or "", user["password_hash"]):
        raise HTTPException(401, "用户名或密码错误")
    last_login_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(
        "UPDATE users SET last_login_at = ?, last_login_ip = ? WHERE id = ? AND tenant_id = ?",
        (last_login_at, request.client.host if request.client else None, user["id"], user["tenant_id"]),
    )
    return {
        "token": auth.create_token(user["id"], user["tenant_id"], user["token_version"]),
        "tenant_code": tenant_code,
        "user": public_user(user["id"], user["tenant_id"]),
    }


@app.get("/api/auth/me")
def me(user=Depends(auth.get_current_user)):
    return public_user(user["id"], user["tenant_id"])


# ---------- 知识库 ----------

@app.get("/api/kbs")
def list_kbs(user=Depends(auth.get_current_user)):
    return db.query(
        "SELECT k.*, "
        "  (SELECT COUNT(*) FROM documents d WHERE d.kb_id = k.id) AS document_count "
        "FROM knowledge_bases k WHERE k.tenant_id = ? ORDER BY k.created_at DESC",
        (user["tenant_id"],),
    )


@app.post("/api/kbs")
def create_kb(req: KBRequest, user=Depends(auth.require_admin)):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "知识库名称不能为空")
    kb_id = uuid.uuid4().hex
    db.execute(
        "INSERT INTO knowledge_bases (id, tenant_id, name, description, created_by, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (kb_id, user["tenant_id"], name, (req.description or "").strip(), user["id"], db.now()),
    )
    return db.query_one("SELECT * FROM knowledge_bases WHERE id = ? AND tenant_id = ?", (kb_id, user["tenant_id"]))


@app.patch("/api/kbs/{kb_id}")
def update_kb(kb_id: str, req: KBRequest, user=Depends(auth.require_admin)):
    kb = get_kb_or_404(kb_id, user["tenant_id"])
    name = (req.name or "").strip() or kb["name"]
    description = req.description if req.description is not None else kb["description"]
    db.execute(
        "UPDATE knowledge_bases SET name = ?, description = ? WHERE id = ? AND tenant_id = ?",
        (name, description, kb_id, user["tenant_id"]),
    )
    return db.query_one("SELECT * FROM knowledge_bases WHERE id = ? AND tenant_id = ?", (kb_id, user["tenant_id"]))


@app.delete("/api/kbs/{kb_id}")
def delete_kb(kb_id: str, user=Depends(auth.require_admin)):
    get_kb_or_404(kb_id, user["tenant_id"])
    docs = db.query("SELECT id, filename FROM documents WHERE tenant_id = ? AND kb_id = ?", (user["tenant_id"], kb_id))
    # 级联删除 docs / chunks / sessions / messages
    db.execute("DELETE FROM knowledge_bases WHERE id = ? AND tenant_id = ?", (kb_id, user["tenant_id"]))
    for d in docs:
        _remove_original_file(user["tenant_id"], d["id"], d["filename"])
    return {"deleted": True}


# ---------- 文档 ----------

@app.get("/api/kbs/{kb_id}/documents")
def list_documents(kb_id: str, user=Depends(auth.get_current_user)):
    get_kb_or_404(kb_id, user["tenant_id"])
    return db.query(
        "SELECT * FROM documents WHERE tenant_id = ? AND kb_id = ? ORDER BY created_at DESC",
        (user["tenant_id"], kb_id),
    )


@app.post("/api/kbs/{kb_id}/documents")
async def upload_document(kb_id: str, file: UploadFile = File(...),
                          user=Depends(auth.get_current_user)):
    get_kb_or_404(kb_id, user["tenant_id"])
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

    doc_id = uuid.uuid4().hex
    db.execute(
        "INSERT INTO documents (id, tenant_id, kb_id, filename, size, chunk_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?)",
        (doc_id, user["tenant_id"], kb_id, filename, len(data), db.now()),
    )
    with open(_original_path(user["tenant_id"], doc_id, filename), "wb") as f:
        f.write(data)

    try:
        chunk_count = vector_store.index_document(user["tenant_id"], doc_id, kb_id, filename, text)
    except Exception as e:
        # 向量化失败则回滚，避免留下半截数据
        db.execute("DELETE FROM documents WHERE id = ? AND tenant_id = ?", (doc_id, user["tenant_id"]))
        _remove_original_file(user["tenant_id"], doc_id, filename)
        raise HTTPException(500, f"向量化失败：{e}")

    return {
        "document": db.query_one("SELECT * FROM documents WHERE id = ? AND tenant_id = ?", (doc_id, user["tenant_id"])),
        "chunk_count": chunk_count,
    }


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, user=Depends(auth.require_admin)):
    doc = db.query_one("SELECT * FROM documents WHERE id = ? AND tenant_id = ?", (doc_id, user["tenant_id"]))
    if not doc:
        raise HTTPException(404, "文档不存在")
    db.execute("DELETE FROM documents WHERE id = ? AND tenant_id = ?", (doc_id, user["tenant_id"]))
    _remove_original_file(user["tenant_id"], doc_id, doc["filename"])
    return {"deleted": True}


# ---------- 会话 ----------

@app.get("/api/kbs/{kb_id}/sessions")
def list_sessions(kb_id: str, user=Depends(auth.get_current_user)):
    get_kb_or_404(kb_id, user["tenant_id"])
    return db.query(
        "SELECT s.id, s.title, s.created_at, "
        "  (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS message_count "
        "FROM sessions s WHERE s.tenant_id = ? AND s.kb_id = ? AND s.user_id = ? "
        "ORDER BY s.created_at DESC",
        (user["tenant_id"], kb_id, user["id"]),
    )


@app.post("/api/kbs/{kb_id}/sessions")
def create_session(kb_id: str, req: SessionCreate, user=Depends(auth.get_current_user)):
    get_kb_or_404(kb_id, user["tenant_id"])
    session_id = uuid.uuid4().hex
    title = (req.title or "").strip() or "新会话"
    db.execute(
        "INSERT INTO sessions (id, tenant_id, user_id, kb_id, title, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, user["tenant_id"], user["id"], kb_id, title, db.now()),
    )
    return db.query_one(
        "SELECT id, title, kb_id, created_at FROM sessions WHERE id = ? AND tenant_id = ?",
        (session_id, user["tenant_id"]),
    )


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, user=Depends(auth.get_current_user)):
    session = db.query_one(
        "SELECT id, title, kb_id, created_at FROM sessions WHERE id = ? AND user_id = ? AND tenant_id = ?",
        (session_id, user["id"], user["tenant_id"]),
    )
    if not session:
        raise HTTPException(404, "会话不存在")
    messages = db.query(
        "SELECT id, role, content, sources FROM messages WHERE session_id = ? AND tenant_id = ? ORDER BY id",
        (session_id, user["tenant_id"]),
    )
    for m in messages:
        try:
            m["sources"] = json.loads(m.get("sources") or "[]")
        except Exception:
            m["sources"] = []
    session["messages"] = messages
    return session


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, user=Depends(auth.get_current_user)):
    if user["role"] == "admin":
        session = db.query_one("SELECT * FROM sessions WHERE id = ? AND tenant_id = ?", (session_id, user["tenant_id"]))
    else:
        session = db.query_one(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ? AND tenant_id = ?",
            (session_id, user["id"], user["tenant_id"]),
        )
    if not session:
        raise HTTPException(404, "会话不存在")
    db.execute("DELETE FROM sessions WHERE id = ? AND tenant_id = ?", (session_id, user["tenant_id"]))
    return {"deleted": True}


# ---------- 用户（仅 admin） ----------

@app.get("/api/users")
def list_users(user=Depends(auth.require_admin)):
    return db.query(
        "SELECT id, tenant_id, username, email, phone, nickname, avatar, role, status, created_at "
        "FROM users WHERE tenant_id = ? AND deleted_at IS NULL ORDER BY created_at",
        (user["tenant_id"],),
    )


@app.post("/api/users")
def create_user(req: UserCreate, user=Depends(auth.require_admin)):
    username = _normalize_username(req.username)
    password = req.password or ""
    _validate_new_password(password)
    role = req.role if req.role in ("admin", "operator", "user") else "user"
    user_id = uuid.uuid4().hex
    try:
        created_role = db.create_user_atomically(
            user_id, user["tenant_id"], username, auth.hash_password(password), role
        )
    except Exception as exc:
        if getattr(exc, "args", ()) and exc.args[0] in (1062, 19):
            raise HTTPException(409, "用户名已存在") from exc
        raise
    if created_role is None:
        raise HTTPException(409, "用户名已存在")
    return public_user(user_id, user["tenant_id"])


@app.patch("/api/users/{user_id}")
def update_user(user_id: str, req: UserUpdate, user=Depends(auth.require_admin)):
    target = db.query_one(
        "SELECT * FROM users WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
        (user_id, user["tenant_id"]),
    )
    if not target:
        raise HTTPException(404, "用户不存在")
    if req.password:
        _validate_new_password(req.password)
        db.execute(
            "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ? AND tenant_id = ?",
            (auth.hash_password(req.password), user_id, user["tenant_id"]),
        )
    if req.role in ("admin", "operator", "user"):
        if user_id == user["id"] and req.role != "admin":
            raise HTTPException(400, "不能取消自己的管理员权限")
        db.execute(
            "UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ? AND tenant_id = ?",
            (req.role, user_id, user["tenant_id"]),
        )
    return public_user(user_id, user["tenant_id"])


@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, user=Depends(auth.require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "不能删除自己")
    if not db.query_one(
        "SELECT * FROM users WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL",
        (user_id, user["tenant_id"]),
    ):
        raise HTTPException(404, "用户不存在")
    db.execute(
        "UPDATE users SET status = 0, deleted_at = ?, token_version = token_version + 1 "
        "WHERE id = ? AND tenant_id = ?",
        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), user_id, user["tenant_id"]),
    )
    return {"deleted": True}


# ---------- 对话（SSE 流式） ----------

@app.post("/api/chat/stream")
def chat_stream(req: ChatRequest, user=Depends(auth.get_current_user)):
    query = req.message.strip()
    kb_id = req.kb_id.strip()
    session_id = (req.session_id or "").strip()

    if not query:
        raise HTTPException(400, "消息为空")
    get_kb_or_404(kb_id, user["tenant_id"])

    if session_id:
        session = db.query_one(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ? AND tenant_id = ?",
            (session_id, user["id"], user["tenant_id"]),
        )
        if not session:
            raise HTTPException(404, "会话不存在")
        if session["kb_id"] != kb_id:
            raise HTTPException(400, "会话不属于该知识库")
    else:
        session_id = uuid.uuid4().hex
        db.execute(
            "INSERT INTO sessions (id, tenant_id, user_id, kb_id, title, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, user["tenant_id"], user["id"], kb_id, query[:20], db.now()),
        )

    def generate():
        results = vector_store.search(user["tenant_id"], kb_id, query)
        history = db.query(
            "SELECT role, content FROM messages WHERE session_id = ? AND tenant_id = ? ORDER BY id",
            (session_id, user["tenant_id"]),
        )
        messages = build_messages(history, query, results)

        # 先发 meta：会话 id + 检索来源
        sources = [
            {"filename": r["filename"], "score": round(r["score"], 4)}
            for r in results
        ]
        yield sse_event({
            "type": "meta",
            "session_id": session_id,
            "sources": sources,
        })

        full_answer = ""
        try:
            for token in llm.chat_stream(messages):
                full_answer += token
                yield sse_event({"type": "content", "text": token})
        except Exception as e:
            yield sse_event({"type": "error", "message": str(e)})

        # 流结束后保存本轮问答
        now = db.now()
        db.execute(
            "INSERT INTO messages (tenant_id, session_id, role, content, sources, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user["tenant_id"], session_id, "user", query, "[]", now),
        )
        if full_answer:
            db.execute(
                "INSERT INTO messages (tenant_id, session_id, role, content, sources, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (user["tenant_id"], session_id, "assistant", full_answer,
                 json.dumps(sources, ensure_ascii=False), now),
            )

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------- 前端静态资源（生产模式，dev 用 Vite proxy） ----------

if os.path.isdir(config.FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIST, html=True), name="frontend")
