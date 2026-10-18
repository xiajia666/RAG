"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update

from controllers.common import (
    _normalize_tenant_code, _normalize_username, _validate_new_password, public_user,
)
from core import config, db
from rag import llm
from rag import vector_store
from security import authentication as auth
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import LoginRequest, PasswordChange, RegisterRequest
from services import document_service

@api.post('/api/auth/register')
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
        if db.is_duplicate_error(exc):
            raise HTTPException(409, "租户代码已被使用") from exc
        raise
    return {
        "token": auth.create_token(user_id, tenant_id, 1),
        "tenant_code": tenant_code,
        "user": public_user(user_id, tenant_id),
    }


@api.post('/api/auth/login')
def login(req: LoginRequest, request):
    raw_username = (req.username or "").strip()
    username = unicodedata.normalize("NFKC", raw_username).casefold()
    tenant_code = _normalize_tenant_code(req.tenant_code)
    user = db.query_one(
        select(db.User)
        .join(db.Tenant, db.Tenant.id == db.User.tenant_id)
        .where(
            db.Tenant.tenant_code == tenant_code, db.Tenant.status == 1,
            db.User.username == username, db.User.status == 1, db.User.deleted_at.is_(None),
        ),
    )
    if not user or not auth.verify_password(req.password or "", user["password_hash"]):
        raise HTTPException(401, "用户名或密码错误")
    last_login_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.execute(update(db.User).where(db.User.id == user["id"], db.User.tenant_id == user["tenant_id"])
               .values(last_login_at=last_login_at, last_login_ip=request.client.host if request.client else None))
    return {
        "token": auth.create_token(user["id"], user["tenant_id"], user["token_version"]),
        "tenant_code": tenant_code,
        "user": public_user(user["id"], user["tenant_id"]),
    }


@api.get('/api/auth/me')
def me(user=CurrentUser()):
    return public_user(user["id"], user["tenant_id"])


@api.post('/api/auth/change-password')
def change_password(req: PasswordChange, user=CurrentUser()):
    stored = db.query_one(select(db.User.password_hash).where(
        db.User.id == user["id"], db.User.tenant_id == user["tenant_id"],
        db.User.status == 1, db.User.deleted_at.is_(None),
    ))
    if not stored or not auth.verify_password(req.current_password, stored["password_hash"]):
        raise HTTPException(400, "当前密码不正确")
    _validate_new_password(req.new_password or "")
    version = user["token_version"] + 1
    db.execute(update(db.User).where(db.User.id == user["id"], db.User.tenant_id == user["tenant_id"])
               .values(password_hash=auth.hash_password(req.new_password), token_version=version,
                       updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    return {"token": auth.create_token(user["id"], user["tenant_id"], version)}
