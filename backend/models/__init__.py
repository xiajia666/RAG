"""Declarative SQLAlchemy models for all RAG application tables."""
from __future__ import annotations

from sqlalchemy import (
    BigInteger, ForeignKey, ForeignKeyConstraint, Index, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tenant_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "username"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_users_tenant"),
        Index("idx_users_tenant_created", "tenant_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(32), nullable=False)
    username: Mapped[str] = mapped_column(String(191), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(64))
    avatar: Mapped[str | None] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="user")
    status: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    department_id: Mapped[str | None] = mapped_column(String(32))
    last_login_at: Mapped[str | None] = mapped_column(String(40))
    last_login_ip: Mapped[str | None] = mapped_column(String(64))
    token_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)
    deleted_at: Mapped[str | None] = mapped_column(String(40))


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_kb_tenant"),
        ForeignKeyConstraint(["tenant_id", "created_by"], ["users.tenant_id", "users.id"], name="fk_kb_created_by"),
        Index("idx_kb_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        UniqueConstraint("tenant_id", "id", "kb_id"),
        ForeignKeyConstraint(["tenant_id", "kb_id"], ["knowledge_bases.tenant_id", "knowledge_bases.id"], ondelete="CASCADE", name="fk_documents_tenant_kb"),
        Index("idx_documents_tenant_kb", "tenant_id", "kb_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(32), nullable=False)
    kb_id: Mapped[str] = mapped_column(String(32), nullable=False)
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class ChatSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "id"),
        ForeignKeyConstraint(["tenant_id", "user_id"], ["users.tenant_id", "users.id"], name="fk_sessions_tenant_user"),
        ForeignKeyConstraint(["tenant_id", "kb_id"], ["knowledge_bases.tenant_id", "knowledge_bases.id"], ondelete="CASCADE", name="fk_sessions_tenant_kb"),
        Index("idx_sessions_tenant_user", "tenant_id", "user_id"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(32), nullable=False)
    user_id: Mapped[str] = mapped_column(String(32), nullable=False)
    kb_id: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id", "session_id"], ["sessions.tenant_id", "sessions.id"], ondelete="CASCADE", name="fk_messages_tenant_session"),
        Index("idx_messages_tenant_session", "tenant_id", "session_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(32), nullable=False)
    session_id: Mapped[str] = mapped_column(String(32), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class TenantSetting(Base):
    __tablename__ = "tenant_settings"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE", name="fk_tenant_settings_tenant"),
    )

    tenant_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    setting_key: Mapped[str] = mapped_column(String(100), primary_key=True)
    setting_value: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class KnowledgeBaseAccess(Base):
    __tablename__ = "knowledge_base_access"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id", "kb_id"], ["knowledge_bases.tenant_id", "knowledge_bases.id"], ondelete="CASCADE", name="fk_kb_access_kb"),
    )

    tenant_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    access_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="tenant")
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class KnowledgeBaseMember(Base):
    __tablename__ = "knowledge_base_members"
    __table_args__ = (
        ForeignKeyConstraint(["tenant_id", "kb_id"], ["knowledge_bases.tenant_id", "knowledge_bases.id"], ondelete="CASCADE", name="fk_kb_members_kb"),
        ForeignKeyConstraint(["tenant_id", "user_id"], ["users.tenant_id", "users.id"], ondelete="CASCADE", name="fk_kb_members_user"),
    )

    tenant_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    kb_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="reader")
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
