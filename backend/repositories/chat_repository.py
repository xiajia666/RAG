"""Persistence operations for chat sessions and messages."""
import json

from sqlalchemy import insert, select

import db


def get_owned_session(session_id: str, tenant_id: str, user_id: str) -> dict | None:
    return db.query_one(select(db.ChatSession).where(
        db.ChatSession.id == session_id,
        db.ChatSession.user_id == user_id,
        db.ChatSession.tenant_id == tenant_id,
    ))


def create_session(session_id: str, tenant_id: str, user_id: str, kb_id: str, title: str) -> None:
    db.execute(insert(db.ChatSession).values(
        id=session_id, tenant_id=tenant_id, user_id=user_id, kb_id=kb_id,
        title=title, created_at=db.now(),
    ))


def get_history(session_id: str, tenant_id: str) -> list[dict]:
    return db.query(select(db.Message.role, db.Message.content)
                    .where(db.Message.session_id == session_id, db.Message.tenant_id == tenant_id)
                    .order_by(db.Message.id))


def save_exchange(session_id: str, tenant_id: str, query: str, answer: str, sources: list[dict]) -> None:
    timestamp = db.now()
    db.execute(insert(db.Message).values(
        tenant_id=tenant_id, session_id=session_id, role="user", content=query,
        sources="[]", created_at=timestamp,
    ))
    if answer:
        db.execute(insert(db.Message).values(
            tenant_id=tenant_id, session_id=session_id, role="assistant", content=answer,
            sources=json.dumps(sources, ensure_ascii=False), created_at=timestamp,
        ))
