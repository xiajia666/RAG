"""Pydantic 请求模型。"""
from typing import Optional

from pydantic import BaseModel


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
