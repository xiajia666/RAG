"""Shared controller helpers; business workflows belong in services."""
import json
import re
import unicodedata

from flask import jsonify
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update

from security import authentication as auth
from core import config, db
from controllers.runtime import HTTPException


def sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def public_user(user_id, tenant_id):
    return db.query_one(
        select(db.User.id, db.User.tenant_id, db.User.username, db.User.email, db.User.phone,
               db.User.nickname, db.User.avatar, db.User.role, db.User.status, db.User.created_at)
        .where(db.User.id == user_id, db.User.tenant_id == tenant_id, db.User.deleted_at.is_(None)),
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
    kb = db.query_one(select(db.KnowledgeBase).where(
        db.KnowledgeBase.id == kb_id, db.KnowledgeBase.tenant_id == tenant_id
    ))
    if not kb:
        raise HTTPException(404, "知识库不存在")
    return kb

def _kb_membership(kb_id, user):
    mode = db.query_one(select(db.KnowledgeBaseAccess.access_mode).where(
        db.KnowledgeBaseAccess.tenant_id == user["tenant_id"], db.KnowledgeBaseAccess.kb_id == kb_id
    ))
    membership = db.query_one(select(db.KnowledgeBaseMember.role).where(
        db.KnowledgeBaseMember.tenant_id == user["tenant_id"], db.KnowledgeBaseMember.kb_id == kb_id,
        db.KnowledgeBaseMember.user_id == user["id"],
    ))
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
    for kb in db.query(select(db.KnowledgeBase.id).where(db.KnowledgeBase.tenant_id == user["tenant_id"])):
        try:
            _kb_membership(kb["id"], user)
            ids.append(kb["id"])
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
    return ids

def _tenant_activity(tenant_id, kb_ids, limit=8):
    if not kb_ids:
        return []
    docs = db.query(
        select(db.Document.filename.label("target"), db.Document.created_at)
        .where(db.Document.tenant_id == tenant_id, db.Document.kb_id.in_(kb_ids))
        .order_by(db.Document.created_at.desc()).limit(limit),
    )
    kbs = db.query(
        select(db.KnowledgeBase.name.label("target"), db.KnowledgeBase.created_at)
        .where(db.KnowledgeBase.tenant_id == tenant_id, db.KnowledgeBase.id.in_(kb_ids))
        .order_by(db.KnowledgeBase.created_at.desc()).limit(limit),
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
    kb_rows = db.query(
        select(
            db.KnowledgeBase.id, db.KnowledgeBase.name,
            func.count(distinct(db.Document.id)).label("document_count"),
            func.count(distinct(case((db.Message.role == "user", db.Message.id)))).label("query_count"),
        )
        .outerjoin(db.Document, and_(db.Document.tenant_id == db.KnowledgeBase.tenant_id,
                                     db.Document.kb_id == db.KnowledgeBase.id))
        .outerjoin(db.ChatSession, and_(db.ChatSession.tenant_id == db.KnowledgeBase.tenant_id,
                                        db.ChatSession.kb_id == db.KnowledgeBase.id))
        .outerjoin(db.Message, and_(db.Message.tenant_id == db.ChatSession.tenant_id,
                                    db.Message.session_id == db.ChatSession.id))
        .where(db.KnowledgeBase.tenant_id == tenant_id, db.KnowledgeBase.id.in_(kb_ids))
        .group_by(db.KnowledgeBase.id, db.KnowledgeBase.name)
        .order_by(func.count(distinct(case((db.Message.role == "user", db.Message.id)))).desc(), db.KnowledgeBase.name),
    )
    return kb_rows
