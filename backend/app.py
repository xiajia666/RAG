"""FastAPI 后端：多知识库 + 云端向量检索 + 多用户 + 流式问答。"""
import json
import os
import re
import secrets
import unicodedata
import uuid
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
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
    TenantUpdate,
    SettingsUpdate,
    BulkDocumentDelete,
    InviteRequest,
    PasswordChange,
    KnowledgeBaseMembersUpdate,
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


def _kb_membership(kb_id, user):
    mode = db.query_one(
        "SELECT access_mode FROM knowledge_base_access WHERE tenant_id = ? AND kb_id = ?",
        (user["tenant_id"], kb_id),
    )
    membership = db.query_one(
        "SELECT role FROM knowledge_base_members WHERE tenant_id = ? AND kb_id = ? AND user_id = ?",
        (user["tenant_id"], kb_id, user["id"]),
    )
    access_mode = mode["access_mode"] if mode else "tenant"
    if user["role"] == "admin" or access_mode == "tenant":
        return access_mode, membership
    if membership is None:
        raise HTTPException(404, "知识库不存在")
    return access_mode, membership


def get_kb_for_user(kb_id, user, write=False):
    kb = get_kb_or_404(kb_id, user["tenant_id"])
    access_mode, membership = _kb_membership(kb_id, user)
    if write and user["role"] != "admin":
        if access_mode == "restricted" and (not membership or membership["role"] != "editor"):
            raise HTTPException(403, "没有该知识库的编辑权限")
        if access_mode == "tenant" and user["role"] == "user":
            raise HTTPException(403, "当前账号只有只读权限")
    return kb


def accessible_kb_ids(user):
    ids = []
    for kb in db.query("SELECT id FROM knowledge_bases WHERE tenant_id = ?", (user["tenant_id"],)):
        try:
            _kb_membership(kb["id"], user)
            ids.append(kb["id"])
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
    return ids


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


@app.get("/api/tenant")
def get_tenant(user=Depends(auth.get_current_user)):
    tenant = db.query_one(
        "SELECT id, tenant_code, name, created_at FROM tenants WHERE id = ? AND status = 1",
        (user["tenant_id"],),
    )
    if not tenant:
        raise HTTPException(404, "企业不存在")
    return tenant


@app.patch("/api/tenant")
def update_tenant(req: TenantUpdate, user=Depends(auth.require_admin)):
    name = req.name.strip()
    if not name or len(name) > 128:
        raise HTTPException(400, "企业名称不能为空且不能超过 128 个字符")
    db.execute(
        "UPDATE tenants SET name = ?, updated_at = ? WHERE id = ?",
        (name, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), user["tenant_id"]),
    )
    return get_tenant(user)


@app.get("/api/settings")
def get_settings(user=Depends(auth.get_current_user)):
    rows = db.query(
        "SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = ?",
        (user["tenant_id"],),
    )
    result = {}
    for row in rows:
        try:
            result[row["setting_key"]] = json.loads(row["setting_value"])
        except (TypeError, ValueError):
            result[row["setting_key"]] = row["setting_value"]
    return result


@app.get("/api/models")
def list_models(user=Depends(auth.get_current_user)):
    return {
        "embedding_model": config.EMBEDDING_MODEL,
        "chat_model": config.DEEPSEEK_MODEL,
        "embedding_configured": bool(config.EMBEDDING_API_KEY),
        "chat_configured": bool(config.DEEPSEEK_API_KEY),
    }


@app.patch("/api/settings")
def update_settings(req: SettingsUpdate, user=Depends(auth.require_admin)):
    allowed = {"language", "email_notifications", "embedding_model", "chat_model", "top_k", "security"}
    if set(req.settings) - allowed:
        raise HTTPException(400, "设置项包含不支持的字段")
    for key, value in req.settings.items():
        if key == "top_k" and (not isinstance(value, int) or not 1 <= value <= 10):
            raise HTTPException(400, "最大召回片段数必须在 1 到 10 之间")
        db.set_tenant_setting(
            user["tenant_id"], key, json.dumps(value, ensure_ascii=False)
        )
    return get_settings(user)


# ---------- 知识库 ----------

@app.get("/api/kbs")
def list_kbs(user=Depends(auth.get_current_user)):
    accessible = set(accessible_kb_ids(user))
    visible = [kb for kb in db.query(
        "SELECT k.*, "
        "  (SELECT COUNT(*) FROM documents d WHERE d.tenant_id = k.tenant_id AND d.kb_id = k.id) AS document_count "
        "FROM knowledge_bases k WHERE k.tenant_id = ? ORDER BY k.created_at DESC",
        (user["tenant_id"],),
    ) if kb["id"] in accessible]
    for kb in visible:
        mode, membership = _kb_membership(kb["id"], user)
        kb["access_role"] = "admin" if user["role"] == "admin" else (
            (membership["role"] if membership else "reader") if mode == "restricted"
            else ("editor" if user["role"] == "operator" else "reader")
        )
    return visible


def _tenant_activity(tenant_id, kb_ids, limit=8):
    if not kb_ids:
        return []
    placeholders = ",".join("?" for _ in kb_ids)
    docs = db.query(
        f"SELECT d.filename AS target, d.created_at FROM documents d "
        f"WHERE d.tenant_id = ? AND d.kb_id IN ({placeholders}) ORDER BY d.created_at DESC LIMIT ?",
        (tenant_id, *kb_ids, limit),
    )
    kbs = db.query(
        f"SELECT name AS target, created_at FROM knowledge_bases WHERE tenant_id = ? AND id IN ({placeholders}) "
        "ORDER BY created_at DESC LIMIT ?",
        (tenant_id, *kb_ids, limit),
    )
    events = [
        {"type": "upload", "target": row["target"], "actor": "成员", "created_at": row["created_at"]}
        for row in docs
    ] + [
        {"type": "create", "target": row["target"], "actor": "成员", "created_at": row["created_at"]}
        for row in kbs
    ]
    return sorted(events, key=lambda event: str(event["created_at"]), reverse=True)[:limit]


def _tenant_usage(tenant_id, kb_ids):
    if not kb_ids:
        return []
    placeholders = ",".join("?" for _ in kb_ids)
    kb_rows = db.query(
        "SELECT k.id, k.name, COUNT(DISTINCT d.id) AS document_count, "
        "COUNT(DISTINCT CASE WHEN m.role = 'user' THEN m.id END) AS query_count "
        "FROM knowledge_bases k LEFT JOIN documents d ON d.tenant_id = k.tenant_id AND d.kb_id = k.id "
        "LEFT JOIN sessions s ON s.tenant_id = k.tenant_id AND s.kb_id = k.id "
        "LEFT JOIN messages m ON m.tenant_id = s.tenant_id AND m.session_id = s.id "
        f"WHERE k.tenant_id = ? AND k.id IN ({placeholders}) "
        "GROUP BY k.id, k.name ORDER BY query_count DESC, k.name",
        (tenant_id, *kb_ids),
    )
    return kb_rows


@app.get("/api/dashboard")
def dashboard(user=Depends(auth.get_current_user)):
    tenant_id = user["tenant_id"]
    now = datetime.now().astimezone()
    kb_ids = accessible_kb_ids(user)
    if not kb_ids:
        usage = []
        query_rows = []
        document_count = 0
        activity = []
    else:
        placeholders = ",".join("?" for _ in kb_ids)
        query_rows = db.query(
            f"SELECT m.created_at FROM messages m JOIN sessions s "
            f"ON s.id = m.session_id AND s.tenant_id = m.tenant_id "
            f"WHERE m.tenant_id = ? AND m.role = 'user' AND s.kb_id IN ({placeholders}) AND m.created_at >= ?",
            (tenant_id, *kb_ids, now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S")),
        )
        usage = _tenant_usage(tenant_id, kb_ids)
        document_count = db.query_one(
            f"SELECT COUNT(*) AS n FROM documents WHERE tenant_id = ? AND kb_id IN ({placeholders})",
            (tenant_id, *kb_ids),
        )["n"]
        activity = _tenant_activity(tenant_id, kb_ids)
    start = (now - timedelta(days=6)).date()
    trend_counts = { (start + timedelta(days=i)).isoformat(): 0 for i in range(7) }
    month_prefix = now.strftime("%Y-%m")
    month_count = 0
    for row in query_rows:
        date_value = str(row["created_at"] or "")[:10]
        if date_value in trend_counts:
            trend_counts[date_value] += 1
        if str(row["created_at"] or "").startswith(month_prefix):
            month_count += 1
    return {
        "stats": {
            "knowledge_bases": len(usage),
            "documents": document_count,
            "queries_this_month": month_count,
            "members": db.query_one("SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND deleted_at IS NULL", (tenant_id,))["n"],
        },
        "trend": [{"date": day, "count": count} for day, count in trend_counts.items()],
        "top_knowledge_bases": usage[:5],
        "activity": activity,
    }


@app.get("/api/analytics")
def analytics(user=Depends(auth.get_current_user)):
    tenant_id = user["tenant_id"]
    kb_ids = accessible_kb_ids(user)
    if not kb_ids:
        return {"queries_this_month": 0, "active_members": 0, "trend": [], "knowledge_bases": [], "top_questions": []}
    placeholders = ",".join("?" for _ in kb_ids)
    now = datetime.now().astimezone()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = db.query(
        "SELECT m.content, m.created_at, k.name AS kb_name FROM messages m "
        "JOIN sessions s ON s.id = m.session_id AND s.tenant_id = m.tenant_id "
        "JOIN knowledge_bases k ON k.id = s.kb_id AND k.tenant_id = s.tenant_id "
        f"WHERE m.tenant_id = ? AND m.role = 'user' AND k.id IN ({placeholders}) AND m.created_at >= ? ORDER BY m.created_at",
        (tenant_id, *kb_ids, month_start.replace("T", " ").split("+")[0]),
    )
    grouped = {}
    daily = {}
    for row in rows:
        question = (row["content"] or "").strip()
        key = (question[:180], row["kb_name"])
        grouped[key] = grouped.get(key, 0) + 1
        day = str(row["created_at"] or "")[:10]
        daily[day] = daily.get(day, 0) + 1
    return {
        "queries_this_month": len(rows),
        "active_members": db.query_one(
            "SELECT COUNT(DISTINCT s.user_id) AS n FROM sessions s JOIN messages m "
            "ON m.session_id = s.id AND m.tenant_id = s.tenant_id "
            f"WHERE s.tenant_id = ? AND s.kb_id IN ({placeholders}) AND m.role = 'user' AND m.created_at >= ?",
            (tenant_id, *kb_ids, month_start.replace("T", " ").split("+")[0]),
        )["n"],
        "trend": [{"date": day, "count": count} for day, count in sorted(daily.items())],
        "knowledge_bases": _tenant_usage(tenant_id, kb_ids),
        "top_questions": [
            {"question": question, "knowledge_base": kb_name, "count": count}
            for (question, kb_name), count in sorted(grouped.items(), key=lambda item: item[1], reverse=True)[:5]
        ],
    }


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


@app.get("/api/kbs/{kb_id}/members")
def list_kb_members(kb_id: str, user=Depends(auth.require_admin)):
    get_kb_or_404(kb_id, user["tenant_id"])
    access = db.query_one(
        "SELECT access_mode FROM knowledge_base_access WHERE tenant_id = ? AND kb_id = ?",
        (user["tenant_id"], kb_id),
    )
    members = db.query(
        "SELECT u.id AS user_id, u.username, u.email, u.role AS tenant_role, m.role AS kb_role "
        "FROM users u LEFT JOIN knowledge_base_members m "
        "ON m.tenant_id = u.tenant_id AND m.user_id = u.id AND m.kb_id = ? "
        "WHERE u.tenant_id = ? AND u.status = 1 AND u.deleted_at IS NULL ORDER BY u.created_at",
        (kb_id, user["tenant_id"]),
    )
    return {"access_mode": access["access_mode"] if access else "tenant", "members": members}


@app.put("/api/kbs/{kb_id}/members")
def update_kb_members(kb_id: str, req: KnowledgeBaseMembersUpdate, user=Depends(auth.require_admin)):
    get_kb_or_404(kb_id, user["tenant_id"])
    if req.access_mode not in ("tenant", "restricted"):
        raise HTTPException(400, "权限范围无效")
    members = [member.model_dump() if hasattr(member, "model_dump") else member.dict() for member in req.members]
    if len(members) > 500:
        raise HTTPException(400, "单个知识库最多配置 500 位成员")
    seen = set()
    for member in members:
        if member["user_id"] in seen:
            raise HTTPException(400, "成员不能重复")
        seen.add(member["user_id"])
        if member["role"] not in ("editor", "reader"):
            raise HTTPException(400, "知识库角色必须是编辑或只读")
        if not db.query_one(
            "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND status = 1 AND deleted_at IS NULL",
            (member["user_id"], user["tenant_id"]),
        ):
            raise HTTPException(400, "所选成员不属于当前企业或已停用")
    db.replace_kb_members(user["tenant_id"], kb_id, req.access_mode, members)
    return list_kb_members(kb_id, user)


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

@app.get("/api/documents")
def list_all_documents(user=Depends(auth.get_current_user)):
    visible = set(accessible_kb_ids(user))
    return [doc for doc in db.query(
        "SELECT d.*, k.name AS knowledge_base_name FROM documents d "
        "JOIN knowledge_bases k ON k.id = d.kb_id AND k.tenant_id = d.tenant_id "
        "WHERE d.tenant_id = ? ORDER BY d.created_at DESC",
        (user["tenant_id"],),
    ) if doc["kb_id"] in visible]


@app.get("/api/documents/{doc_id}/preview")
def preview_document(doc_id: str, user=Depends(auth.get_current_user)):
    doc = db.query_one(
        "SELECT d.*, k.name AS knowledge_base_name FROM documents d "
        "JOIN knowledge_bases k ON k.id = d.kb_id AND k.tenant_id = d.tenant_id "
        "WHERE d.id = ? AND d.tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user)
    chunks = db.query(
        "SELECT chunk_index, content, created_at FROM chunks "
        "WHERE doc_id = ? AND tenant_id = ? ORDER BY chunk_index LIMIT 5",
        (doc_id, user["tenant_id"]),
    )
    return {"document": doc, "chunks": chunks}


@app.get("/api/documents/{doc_id}/file")
def download_document(doc_id: str, user=Depends(auth.get_current_user)):
    doc = db.query_one(
        "SELECT id, kb_id, filename FROM documents WHERE id = ? AND tenant_id = ?",
        (doc_id, user["tenant_id"]),
    )
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user)
    paths = (
        _original_path(user["tenant_id"], doc_id, doc["filename"]),
        os.path.join(config.DOCUMENTS_DIR, f"{doc_id}_{doc['filename']}"),
    )
    path = next((candidate for candidate in paths if os.path.isfile(candidate)), None)
    if not path:
        raise HTTPException(404, "原始文件不存在")
    return FileResponse(path, filename=doc["filename"])


@app.post("/api/documents/bulk-delete")
def bulk_delete_documents(req: BulkDocumentDelete, user=Depends(auth.get_current_user)):
    if len(req.document_ids) > 200:
        raise HTTPException(400, "单次最多删除 200 份文档")
    docs = []
    for doc_id in set(req.document_ids):
        doc = db.query_one(
            "SELECT id, kb_id, filename FROM documents WHERE id = ? AND tenant_id = ?",
            (doc_id, user["tenant_id"]),
        )
        if doc:
            get_kb_for_user(doc["kb_id"], user, write=True)
            docs.append(doc)
    for doc in docs:
        db.execute("DELETE FROM documents WHERE id = ? AND tenant_id = ?", (doc["id"], user["tenant_id"]))
        _remove_original_file(user["tenant_id"], doc["id"], doc["filename"])
    return {"deleted_count": len(docs)}

@app.get("/api/kbs/{kb_id}/documents")
def list_documents(kb_id: str, user=Depends(auth.get_current_user)):
    get_kb_for_user(kb_id, user)
    return db.query(
        "SELECT * FROM documents WHERE tenant_id = ? AND kb_id = ? ORDER BY created_at DESC",
        (user["tenant_id"], kb_id),
    )


@app.post("/api/kbs/{kb_id}/documents")
async def upload_document(kb_id: str, file: UploadFile = File(...),
                          user=Depends(auth.get_current_user)):
    get_kb_for_user(kb_id, user, write=True)
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
def delete_document(doc_id: str, user=Depends(auth.get_current_user)):
    doc = db.query_one("SELECT * FROM documents WHERE id = ? AND tenant_id = ?", (doc_id, user["tenant_id"]))
    if not doc:
        raise HTTPException(404, "文档不存在")
    get_kb_for_user(doc["kb_id"], user, write=True)
    db.execute("DELETE FROM documents WHERE id = ? AND tenant_id = ?", (doc_id, user["tenant_id"]))
    _remove_original_file(user["tenant_id"], doc_id, doc["filename"])
    return {"deleted": True}


# ---------- 会话 ----------

@app.get("/api/kbs/{kb_id}/sessions")
def list_sessions(kb_id: str, user=Depends(auth.get_current_user)):
    get_kb_for_user(kb_id, user)
    return db.query(
        "SELECT s.id, s.title, s.created_at, "
        "  (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.tenant_id = s.tenant_id) AS message_count "
        "FROM sessions s WHERE s.tenant_id = ? AND s.kb_id = ? AND s.user_id = ? "
        "ORDER BY s.created_at DESC",
        (user["tenant_id"], kb_id, user["id"]),
    )


@app.post("/api/kbs/{kb_id}/sessions")
def create_session(kb_id: str, req: SessionCreate, user=Depends(auth.get_current_user)):
    get_kb_for_user(kb_id, user)
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
    get_kb_for_user(session["kb_id"], user)
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
    get_kb_for_user(session["kb_id"], user)
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


@app.post("/api/users/invite")
def invite_user(req: InviteRequest, user=Depends(auth.require_admin)):
    email = (req.email or "").strip().lower()
    if len(email) > 255 or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(400, "请输入有效的邮箱地址")
    username = _normalize_username(req.username or email.split("@", 1)[0])
    role = req.role if req.role in ("operator", "user") else "user"
    temp_password = secrets.token_urlsafe(12)
    user_id = uuid.uuid4().hex
    try:
        created = db.create_user_atomically(
            user_id, user["tenant_id"], username, auth.hash_password(temp_password), role, email
        )
    except Exception as exc:
        if getattr(exc, "args", ()) and exc.args[0] in (1062, 19):
            raise HTTPException(409, "登录用户名已存在，请为成员填写其他用户名") from exc
        raise
    if created is None:
        raise HTTPException(409, "登录用户名已存在，请为成员填写其他用户名")
    return {"user": public_user(user_id, user["tenant_id"]), "temporary_password": temp_password}


@app.post("/api/users/{user_id}/reset-password")
def reset_user_password(user_id: str, user=Depends(auth.require_admin)):
    target = db.query_one(
        "SELECT id FROM users WHERE id = ? AND tenant_id = ? AND status = 1 AND deleted_at IS NULL",
        (user_id, user["tenant_id"]),
    )
    if not target:
        raise HTTPException(404, "用户不存在")
    temp_password = secrets.token_urlsafe(12)
    db.execute(
        "UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = ? "
        "WHERE id = ? AND tenant_id = ?",
        (auth.hash_password(temp_password), datetime.now().strftime("%Y-%m-%d %H:%M:%S"), user_id, user["tenant_id"]),
    )
    return {"temporary_password": temp_password}


@app.post("/api/auth/change-password")
def change_password(req: PasswordChange, user=Depends(auth.get_current_user)):
    stored = db.query_one(
        "SELECT password_hash FROM users WHERE id = ? AND tenant_id = ? AND status = 1 AND deleted_at IS NULL",
        (user["id"], user["tenant_id"]),
    )
    if not stored or not auth.verify_password(req.current_password, stored["password_hash"]):
        raise HTTPException(400, "当前密码不正确")
    _validate_new_password(req.new_password or "")
    version = user["token_version"] + 1
    db.execute(
        "UPDATE users SET password_hash = ?, token_version = ?, updated_at = ? WHERE id = ? AND tenant_id = ?",
        (auth.hash_password(req.new_password), version, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), user["id"], user["tenant_id"]),
    )
    return {"token": auth.create_token(user["id"], user["tenant_id"], version)}


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
        if target["role"] == "admin" and req.role != "admin":
            admin_count = db.query_one(
                "SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND role = 'admin' "
                "AND status = 1 AND deleted_at IS NULL",
                (user["tenant_id"],),
            )["n"]
            if admin_count <= 1:
                raise HTTPException(400, "企业至少需要保留一名管理员")
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
        "DELETE FROM knowledge_base_members WHERE tenant_id = ? AND user_id = ?",
        (user["tenant_id"], user_id),
    )
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
    get_kb_for_user(kb_id, user)

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
