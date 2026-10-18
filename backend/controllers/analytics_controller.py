"""HTTP endpoints for one business domain."""
import json, os, re, secrets, unicodedata, uuid
from datetime import datetime, timedelta
from flask import Response, abort, jsonify, request, send_file, send_from_directory, stream_with_context
from sqlalchemy import and_, case, delete, distinct, func, insert, select, update

from controllers.common import _tenant_activity, _tenant_usage, accessible_kb_ids
from core import config, db
from rag import llm
from rag import vector_store
from security import authentication as auth
from controllers.runtime import AdminUser, CurrentUser, HTTPException, api
from core.schemas import *
from services import document_service

@api.get('/api/dashboard')
def dashboard(user=CurrentUser()):
    tenant_id = user["tenant_id"]
    now = datetime.now().astimezone()
    kb_ids = accessible_kb_ids(user)
    if not kb_ids:
        usage = []
        query_rows = []
        document_count = 0
        activity = []
    else:
        query_rows = db.query(
            select(db.Message.created_at)
            .join(db.ChatSession, and_(db.ChatSession.id == db.Message.session_id,
                                       db.ChatSession.tenant_id == db.Message.tenant_id))
            .where(
                db.Message.tenant_id == tenant_id, db.Message.role == "user",
                db.ChatSession.kb_id.in_(kb_ids),
                db.Message.created_at >= now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).strftime("%Y-%m-%d %H:%M:%S"),
            ),
        )
        usage = _tenant_usage(tenant_id, kb_ids)
        document_count = db.query_one(select(func.count(db.Document.id).label("n")).where(
            db.Document.tenant_id == tenant_id, db.Document.kb_id.in_(kb_ids)
        ))["n"]
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
            "members": db.query_one(select(func.count(db.User.id).label("n")).where(
                db.User.tenant_id == tenant_id, db.User.deleted_at.is_(None)
            ))["n"],
        },
        "trend": [{"date": day, "count": count} for day, count in trend_counts.items()],
        "top_knowledge_bases": usage[:5],
        "activity": activity,
    }


@api.get('/api/analytics')
def analytics(user=CurrentUser()):
    tenant_id = user["tenant_id"]
    kb_ids = accessible_kb_ids(user)
    if not kb_ids:
        return {"queries_this_month": 0, "active_members": 0, "trend": [], "knowledge_bases": [], "top_questions": []}
    now = datetime.now().astimezone()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = db.query(
        select(db.Message.content, db.Message.created_at, db.KnowledgeBase.name.label("kb_name"))
        .join(db.ChatSession, and_(db.ChatSession.id == db.Message.session_id,
                                   db.ChatSession.tenant_id == db.Message.tenant_id))
        .join(db.KnowledgeBase, and_(db.KnowledgeBase.id == db.ChatSession.kb_id,
                                     db.KnowledgeBase.tenant_id == db.ChatSession.tenant_id))
        .where(
            db.Message.tenant_id == tenant_id, db.Message.role == "user",
            db.KnowledgeBase.id.in_(kb_ids),
            db.Message.created_at >= month_start.replace("T", " ").split("+")[0],
        ).order_by(db.Message.created_at),
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
            select(func.count(distinct(db.ChatSession.user_id)).label("n"))
            .join(db.Message, and_(db.Message.session_id == db.ChatSession.id,
                                   db.Message.tenant_id == db.ChatSession.tenant_id))
            .where(
                db.ChatSession.tenant_id == tenant_id, db.ChatSession.kb_id.in_(kb_ids),
                db.Message.role == "user", db.Message.created_at >= month_start.replace("T", " ").split("+")[0],
            )
        )["n"],
        "trend": [{"date": day, "count": count} for day, count in sorted(daily.items())],
        "knowledge_bases": _tenant_usage(tenant_id, kb_ids),
        "top_questions": [
            {"question": question, "knowledge_base": kb_name, "count": count}
            for (question, kb_name), count in sorted(grouped.items(), key=lambda item: item[1], reverse=True)[:5]
        ],
    }
