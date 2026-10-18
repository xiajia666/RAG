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

@api.get('/api/sessions/{session_id}')
def get_session(session_id: str, user=CurrentUser()):
    session = db.query_one(
        select(db.ChatSession.id, db.ChatSession.title, db.ChatSession.kb_id, db.ChatSession.created_at)
        .where(db.ChatSession.id == session_id, db.ChatSession.user_id == user["id"],
               db.ChatSession.tenant_id == user["tenant_id"]),
    )
    if not session:
        raise HTTPException(404, "会话不存在")
    get_kb_for_user(session["kb_id"], user)
    messages = db.query(
        select(db.Message.id, db.Message.role, db.Message.content, db.Message.sources)
        .where(db.Message.session_id == session_id, db.Message.tenant_id == user["tenant_id"])
        .order_by(db.Message.id),
    )
    for m in messages:
        try:
            m["sources"] = json.loads(m.get("sources") or "[]")
        except Exception:
            m["sources"] = []
    session["messages"] = messages
    return session


@api.delete('/api/sessions/{session_id}')
def delete_session(session_id: str, user=CurrentUser()):
    if user["role"] == "admin":
        session = db.query_one(select(db.ChatSession).where(
            db.ChatSession.id == session_id, db.ChatSession.tenant_id == user["tenant_id"]
        ))
    else:
        session = db.query_one(select(db.ChatSession).where(
            db.ChatSession.id == session_id, db.ChatSession.user_id == user["id"],
            db.ChatSession.tenant_id == user["tenant_id"],
        ))
    if not session:
        raise HTTPException(404, "会话不存在")
    get_kb_for_user(session["kb_id"], user)
    db.execute(delete(db.ChatSession).where(db.ChatSession.id == session_id,
                                            db.ChatSession.tenant_id == user["tenant_id"]))
    return {"deleted": True}
