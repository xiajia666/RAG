"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update
from core import config, db
from rag import llm
from rag import vector_store
from security import authentication as auth
from controllers.common import (
    _kb_membership, accessible_kb_ids, get_kb_for_user, get_kb_or_404,
)
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import KBRequest, KnowledgeBaseMembersUpdate, SessionCreate
from services import document_service

# 查询当前用户可访问的知识库列表。
@api.get('/api/kbs')
def list_kbs(user=CurrentUser()):
    accessible = set(accessible_kb_ids(user))
    visible = [kb for kb in db.query(
        select(db.KnowledgeBase, func.count(db.Document.id).label("document_count"))
        .outerjoin(db.Document, and_(db.Document.tenant_id == db.KnowledgeBase.tenant_id,
                                     db.Document.kb_id == db.KnowledgeBase.id))
        .where(db.KnowledgeBase.tenant_id == user["tenant_id"])
        .group_by(db.KnowledgeBase.id).order_by(db.KnowledgeBase.created_at.desc())
    ) if kb["id"] in accessible]
    for kb in visible:
        mode, membership = _kb_membership(kb["id"], user)
        kb["access_role"] = "admin" if user["role"] == "admin" else (
            (membership["role"] if membership else "reader") if mode == "restricted"
            else ("editor" if user["role"] == "operator" else "reader")
        )
    return visible


# 在当前企业创建知识库。
@api.post('/api/kbs')
def create_kb(req: KBRequest, user=AdminUser()):
    name = req.name.strip()
    if not name:
        raise HTTPException(400, "知识库名称不能为空")
    kb_id = uuid.uuid4().hex
    db.execute(insert(db.KnowledgeBase).values(
        id=kb_id, tenant_id=user["tenant_id"], name=name, description=(req.description or "").strip(),
        created_by=user["id"], created_at=db.now(),
    ))
    return db.query_one(select(db.KnowledgeBase).where(
        db.KnowledgeBase.id == kb_id, db.KnowledgeBase.tenant_id == user["tenant_id"]
    ))


# 查询知识库的访问模式和成员权限。
@api.get('/api/kbs/{kb_id}/members')
def list_kb_members(kb_id: str, user=AdminUser()):
    get_kb_or_404(kb_id, user["tenant_id"])
    access = db.query_one(select(db.KnowledgeBaseAccess.access_mode).where(
        db.KnowledgeBaseAccess.tenant_id == user["tenant_id"], db.KnowledgeBaseAccess.kb_id == kb_id
    ))
    members = db.query(
        select(db.User.id.label("user_id"), db.User.username, db.User.email,
               db.User.role.label("tenant_role"), db.KnowledgeBaseMember.role.label("kb_role"))
        .outerjoin(db.KnowledgeBaseMember, and_(
            db.KnowledgeBaseMember.tenant_id == db.User.tenant_id,
            db.KnowledgeBaseMember.user_id == db.User.id,
            db.KnowledgeBaseMember.kb_id == kb_id,
        ))
        .where(db.User.tenant_id == user["tenant_id"], db.User.status == 1, db.User.deleted_at.is_(None))
        .order_by(db.User.created_at),
    )
    return {"access_mode": access["access_mode"] if access else "tenant", "members": members}


# 设置知识库访问模式及成员角色。
@api.put('/api/kbs/{kb_id}/members')
def update_kb_members(kb_id: str, req: KnowledgeBaseMembersUpdate, user=AdminUser()):
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
        if not db.query_one(select(db.User.id).where(
            db.User.id == member["user_id"], db.User.tenant_id == user["tenant_id"],
            db.User.status == 1, db.User.deleted_at.is_(None),
        )):
            raise HTTPException(400, "所选成员不属于当前企业或已停用")
    db.replace_kb_members(user["tenant_id"], kb_id, req.access_mode, members)
    return list_kb_members(kb_id, user)


# 修改知识库名称或描述。
@api.patch('/api/kbs/{kb_id}')
def update_kb(kb_id: str, req: KBRequest, user=AdminUser()):
    kb = get_kb_or_404(kb_id, user["tenant_id"])
    name = (req.name or "").strip() or kb["name"]
    description = req.description if req.description is not None else kb["description"]
    db.execute(update(db.KnowledgeBase).where(
        db.KnowledgeBase.id == kb_id, db.KnowledgeBase.tenant_id == user["tenant_id"]
    ).values(name=name, description=description))
    return db.query_one(select(db.KnowledgeBase).where(
        db.KnowledgeBase.id == kb_id, db.KnowledgeBase.tenant_id == user["tenant_id"]
    ))


# 删除知识库及其关联文档、会话和文件。
@api.delete('/api/kbs/{kb_id}')
def delete_kb(kb_id: str, user=AdminUser()):
    get_kb_or_404(kb_id, user["tenant_id"])
    docs = db.query(select(db.Document.id, db.Document.filename).where(
        db.Document.tenant_id == user["tenant_id"], db.Document.kb_id == kb_id
    ))
    # ES 切片不受 MySQL 外键级联管理，先删除向量索引再删除业务数据。
    vector_store.delete_knowledge_base(user["tenant_id"], kb_id)
    db.execute(delete(db.KnowledgeBase).where(
        db.KnowledgeBase.id == kb_id, db.KnowledgeBase.tenant_id == user["tenant_id"]
    ))
    for d in docs:
        document_service.remove_original_file(user["tenant_id"], d["id"], d["filename"])
    return {"deleted": True}


# 查询指定知识库中的文档。
@api.get('/api/kbs/{kb_id}/documents')
def list_documents(kb_id: str, user=CurrentUser()):
    get_kb_for_user(kb_id, user)
    return db.query(
        select(db.Document).where(db.Document.tenant_id == user["tenant_id"], db.Document.kb_id == kb_id)
        .order_by(db.Document.created_at.desc()),
    )


# 上传文档并执行解析、分块和向量入库。解析方式由表单字段 parse_method 指定：
# plain（纯文本，默认）/ deepdoc（DeepDocs，暂未开放）/ none（仅上传不解析）。
@api.post('/api/kbs/{kb_id}/documents')
def upload_document(kb_id: str, file, request,
                          user=CurrentUser()):
    get_kb_for_user(kb_id, user, write=True)
    parse_method = (request.form.get('parse_method') or 'plain').strip().lower()
    try:
        return document_service.ingest_document(
            user["tenant_id"], kb_id, file.filename, file.read(), parse_method
        )
    except document_service.DocumentIngestionError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc


# 查询当前用户在知识库中的会话列表。
@api.get('/api/kbs/{kb_id}/sessions')
def list_sessions(kb_id: str, user=CurrentUser()):
    get_kb_for_user(kb_id, user)
    return db.query(
        select(
            db.ChatSession.id, db.ChatSession.title, db.ChatSession.created_at,
            select(func.count(db.Message.id)).where(
                db.Message.session_id == db.ChatSession.id,
                db.Message.tenant_id == db.ChatSession.tenant_id,
            ).scalar_subquery().label("message_count"),
        )
        .where(db.ChatSession.tenant_id == user["tenant_id"], db.ChatSession.kb_id == kb_id,
               db.ChatSession.user_id == user["id"])
        .order_by(db.ChatSession.created_at.desc()),
    )


# 在指定知识库中创建聊天会话。
@api.post('/api/kbs/{kb_id}/sessions')
def create_session(kb_id: str, req: SessionCreate, user=CurrentUser()):
    get_kb_for_user(kb_id, user)
    session_id = uuid.uuid4().hex
    title = (req.title or "").strip() or "新会话"
    db.execute(insert(db.ChatSession).values(
        id=session_id, tenant_id=user["tenant_id"], user_id=user["id"], kb_id=kb_id,
        title=title, created_at=db.now(),
    ))
    return db.query_one(
        select(db.ChatSession.id, db.ChatSession.title, db.ChatSession.kb_id, db.ChatSession.created_at)
        .where(db.ChatSession.id == session_id, db.ChatSession.tenant_id == user["tenant_id"]),
    )
