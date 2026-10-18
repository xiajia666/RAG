"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update
from core import config, db
from rag import llm
from rag import vector_store
from security import authentication as auth
from controllers.common import *
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import *
from services import document_service

@api.get('/api/users')
def list_users(user=AdminUser()):
    return db.query(
        select(db.User.id, db.User.tenant_id, db.User.username, db.User.email, db.User.phone,
               db.User.nickname, db.User.avatar, db.User.role, db.User.status, db.User.created_at)
        .where(db.User.tenant_id == user["tenant_id"], db.User.deleted_at.is_(None))
        .order_by(db.User.created_at),
    )


@api.post('/api/users')
def create_user(req: UserCreate, user=AdminUser()):
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
        if db.is_duplicate_error(exc):
            raise HTTPException(409, "用户名已存在") from exc
        raise
    if created_role is None:
        raise HTTPException(409, "用户名已存在")
    return public_user(user_id, user["tenant_id"])


@api.post('/api/users/invite')
def invite_user(req: InviteRequest, user=AdminUser()):
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
        if db.is_duplicate_error(exc):
            raise HTTPException(409, "登录用户名已存在，请为成员填写其他用户名") from exc
        raise
    if created is None:
        raise HTTPException(409, "登录用户名已存在，请为成员填写其他用户名")
    return {"user": public_user(user_id, user["tenant_id"]), "temporary_password": temp_password}


@api.post('/api/users/{user_id}/reset-password')
def reset_user_password(user_id: str, user=AdminUser()):
    target = db.query_one(select(db.User.id).where(
        db.User.id == user_id, db.User.tenant_id == user["tenant_id"], db.User.status == 1,
        db.User.deleted_at.is_(None),
    ))
    if not target:
        raise HTTPException(404, "用户不存在")
    temp_password = secrets.token_urlsafe(12)
    db.execute(update(db.User).where(db.User.id == user_id, db.User.tenant_id == user["tenant_id"])
               .values(password_hash=auth.hash_password(temp_password),
                       token_version=db.User.token_version + 1,
                       updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    return {"temporary_password": temp_password}


@api.patch('/api/users/{user_id}')
def update_user(user_id: str, req: UserUpdate, user=AdminUser()):
    target = db.query_one(select(db.User).where(
        db.User.id == user_id, db.User.tenant_id == user["tenant_id"], db.User.deleted_at.is_(None)
    ))
    if not target:
        raise HTTPException(404, "用户不存在")
    if req.password:
        _validate_new_password(req.password)
        db.execute(update(db.User).where(db.User.id == user_id, db.User.tenant_id == user["tenant_id"])
                   .values(password_hash=auth.hash_password(req.password), token_version=db.User.token_version + 1))
    if req.role in ("admin", "operator", "user"):
        if user_id == user["id"] and req.role != "admin":
            raise HTTPException(400, "不能取消自己的管理员权限")
        if target["role"] == "admin" and req.role != "admin":
            admin_count = db.query_one(select(func.count(db.User.id).label("n")).where(
                db.User.tenant_id == user["tenant_id"], db.User.role == "admin",
                db.User.status == 1, db.User.deleted_at.is_(None),
            ))["n"]
            if admin_count <= 1:
                raise HTTPException(400, "企业至少需要保留一名管理员")
        db.execute(update(db.User).where(db.User.id == user_id, db.User.tenant_id == user["tenant_id"])
                   .values(role=req.role, token_version=db.User.token_version + 1))
    return public_user(user_id, user["tenant_id"])


@api.delete('/api/users/{user_id}')
def delete_user(user_id: str, user=AdminUser()):
    if user_id == user["id"]:
        raise HTTPException(400, "不能删除自己")
    if not db.query_one(select(db.User.id).where(
        db.User.id == user_id, db.User.tenant_id == user["tenant_id"], db.User.deleted_at.is_(None)
    )):
        raise HTTPException(404, "用户不存在")
    db.execute(delete(db.KnowledgeBaseMember).where(
        db.KnowledgeBaseMember.tenant_id == user["tenant_id"], db.KnowledgeBaseMember.user_id == user_id
    ))
    db.execute(update(db.User).where(db.User.id == user_id, db.User.tenant_id == user["tenant_id"])
               .values(status=0, deleted_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                       token_version=db.User.token_version + 1))
    return {"deleted": True}
