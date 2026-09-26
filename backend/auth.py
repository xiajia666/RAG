"""认证：bcrypt 密码 + JWT 令牌。"""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException

import config
import db


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, tenant_id: str, token_version: int) -> str:
    payload = {
        "sub": user_id,
        "tid": tenant_id,
        "ver": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(hours=config.JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def decode_token(token: str):
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except Exception:
        return None


def get_current_user(authorization: str = Header(default="")) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = authorization[7:].strip()
    user_id = decode_token(token)
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
        tenant_id = payload.get("tid")
        token_version = payload.get("ver")
    except Exception:
        tenant_id = token_version = None
    if not user_id or not tenant_id or token_version is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")
    user = db.query_one(
        "SELECT u.* FROM users u JOIN tenants t ON t.id = u.tenant_id "
        "WHERE u.id = ? AND u.tenant_id = ? AND u.token_version = ? "
        "AND u.status = 1 AND u.deleted_at IS NULL AND t.status = 1",
        (user_id, tenant_id, token_version),
    )
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user
