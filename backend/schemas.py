"""Pydantic 请求模型。"""
from typing import Optional

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    tenant_name: str
    tenant_code: str
    username: str
    password: str


class LoginRequest(BaseModel):
    tenant_code: str
    username: str
    password: str


class KBRequest(BaseModel):
    name: str
    description: Optional[str] = None


class SessionCreate(BaseModel):
    title: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    kb_id: str
    session_id: Optional[str] = None


class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"


class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[str] = None


class TenantUpdate(BaseModel):
    name: str


class SettingsUpdate(BaseModel):
    settings: dict


class BulkDocumentDelete(BaseModel):
    document_ids: list[str]


class InviteRequest(BaseModel):
    email: str
    role: Optional[str] = "user"
    username: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class KnowledgeBaseMember(BaseModel):
    user_id: str
    role: str = "reader"


class KnowledgeBaseMembersUpdate(BaseModel):
    access_mode: str
    members: list[KnowledgeBaseMember] = Field(default_factory=list)
