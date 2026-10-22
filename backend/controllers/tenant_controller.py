"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update
from core import config, db
from rag import llm
from rag import vector_store
from security import authentication as auth
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import SettingsUpdate, TenantUpdate
from services import document_service

# 获取当前企业的基本资料。
@api.get('/api/tenant')
def get_tenant(user=CurrentUser()):
    tenant = db.query_one(select(db.Tenant.id, db.Tenant.tenant_code, db.Tenant.name, db.Tenant.created_at)
                          .where(db.Tenant.id == user["tenant_id"], db.Tenant.status == 1))
    if not tenant:
        raise HTTPException(404, "企业不存在")
    return tenant


# 修改当前企业名称。
@api.patch('/api/tenant')
def update_tenant(req: TenantUpdate, user=AdminUser()):
    name = req.name.strip()
    if not name or len(name) > 128:
        raise HTTPException(400, "企业名称不能为空且不能超过 128 个字符")
    db.execute(update(db.Tenant).where(db.Tenant.id == user["tenant_id"])
               .values(name=name, updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    return get_tenant(user)


# 查询当前企业的系统设置。
@api.get('/api/settings')
def get_settings(user=CurrentUser()):
    rows = db.query(select(db.TenantSetting.setting_key, db.TenantSetting.setting_value)
                    .where(db.TenantSetting.tenant_id == user["tenant_id"]))
    result = {}
    for row in rows:
        try:
            result[row["setting_key"]] = json.loads(row["setting_value"])
        except (TypeError, ValueError):
            result[row["setting_key"]] = row["setting_value"]
    return result


# 获取当前配置的问答与向量模型状态。
@api.get('/api/models')
def list_models(user=CurrentUser()):
    return {
        "embedding_model": config.EMBEDDING_MODEL,
        "chat_model": config.DEEPSEEK_MODEL,
        "embedding_configured": bool(config.EMBEDDING_API_KEY),
        "chat_configured": bool(config.DEEPSEEK_API_KEY),
    }


# 更新当前企业允许修改的系统设置。
@api.patch('/api/settings')
def update_settings(req: SettingsUpdate, user=AdminUser()):
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
