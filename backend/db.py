"""SQLAlchemy ORM engine, session helpers, and atomic persistence operations."""
import ssl
import threading
from datetime import datetime

from sqlalchemy import create_engine, delete, event, func, select
from sqlalchemy.engine import URL
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import config
from models import (
    Base, ChatSession, Chunk, Document, KnowledgeBase, KnowledgeBaseAccess,
    KnowledgeBaseMember, Message, Tenant, TenantSetting, User,
)

_lock = threading.Lock()


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _make_engine():
    if config.DATABASE_BACKEND == "mysql":
        if not config.MYSQL_PASSWORD:
            raise RuntimeError("MySQL 模式未配置 MYSQL_PASSWORD")
        connect_args = {"connect_timeout": 8}
        if config.MYSQL_SSL:
            if config.MYSQL_SSL_VERIFY:
                connect_args["ssl"] = ssl.create_default_context(cafile=config.MYSQL_SSL_CA or None)
            else:
                context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                connect_args["ssl"] = context
        url = URL.create(
            "mysql+pymysql", username=config.MYSQL_USER, password=config.MYSQL_PASSWORD,
            host=config.MYSQL_HOST, port=config.MYSQL_PORT, database=config.MYSQL_DATABASE,
            query={"charset": "utf8mb4"},
        )
        return create_engine(url, pool_pre_ping=True, connect_args=connect_args)
    if config.DATABASE_BACKEND != "sqlite":
        raise RuntimeError(f"不支持的 DATABASE_BACKEND: {config.DATABASE_BACKEND}")

    engine = create_engine(
        URL.create("sqlite", database=config.DB_PATH),
        connect_args={"check_same_thread": False, "timeout": 10},
    )

    @event.listens_for(engine, "connect")
    def _configure_sqlite(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


engine = _make_engine()


def is_duplicate_error(exc):
    if not isinstance(exc, IntegrityError):
        return False
    original = getattr(exc, "orig", exc)
    args = getattr(original, "args", ())
    if args and args[0] in (1062, 19):
        return True
    message = str(original).lower()
    return "unique constraint" in message or "duplicate entry" in message


def init_db():
    with _lock:
        Base.metadata.create_all(engine)


def _row_dict(row):
    """Return selected ORM entities or column rows as ordinary dictionaries."""
    mapping = row._mapping
    result = {}
    for key, value in mapping.items():
        if hasattr(value, "__table__"):
            result.update({column.name: getattr(value, column.name) for column in value.__table__.columns})
        else:
            result[key] = value
    return result


def query(statement, params=None):
    with Session(engine) as session:
        return [_row_dict(row) for row in session.execute(statement, params or {}).all()]


def query_one(statement, params=None):
    with Session(engine) as session:
        row = session.execute(statement, params or {}).first()
        return _row_dict(row) if row is not None else None


def execute(statement, params=None):
    with Session(engine) as session, session.begin():
        result = session.execute(statement, params or {})
        return result.lastrowid


def executemany(statement, params_seq):
    params_seq = list(params_seq)
    if not params_seq:
        return
    with Session(engine) as session, session.begin():
        session.execute(statement, params_seq)


def set_tenant_setting(tenant_id, key, value):
    values = {"tenant_id": tenant_id, "setting_key": key, "setting_value": value, "updated_at": now()}
    if config.DATABASE_BACKEND == "mysql":
        statement = mysql_insert(TenantSetting).values(**values)
        statement = statement.on_duplicate_key_update(
            setting_value=statement.inserted.setting_value,
            updated_at=statement.inserted.updated_at,
        )
    else:
        statement = sqlite_insert(TenantSetting).values(**values)
        statement = statement.on_conflict_do_update(
            index_elements=[TenantSetting.tenant_id, TenantSetting.setting_key],
            set_={"setting_value": statement.excluded.setting_value, "updated_at": statement.excluded.updated_at},
        )
    execute(statement)


def replace_kb_members(tenant_id, kb_id, access_mode, members):
    """Atomically replace a knowledge base's access mode and explicit member roles."""
    timestamp = now()
    with Session(engine) as session, session.begin():
        if config.DATABASE_BACKEND == "sqlite":
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        values = {"tenant_id": tenant_id, "kb_id": kb_id, "access_mode": access_mode, "updated_at": timestamp}
        if config.DATABASE_BACKEND == "mysql":
            statement = mysql_insert(KnowledgeBaseAccess).values(**values)
            statement = statement.on_duplicate_key_update(
                access_mode=statement.inserted.access_mode,
                updated_at=statement.inserted.updated_at,
            )
        else:
            statement = sqlite_insert(KnowledgeBaseAccess).values(**values)
            statement = statement.on_conflict_do_update(
                index_elements=[KnowledgeBaseAccess.tenant_id, KnowledgeBaseAccess.kb_id],
                set_={"access_mode": statement.excluded.access_mode, "updated_at": statement.excluded.updated_at},
            )
        session.execute(statement)
        session.execute(delete(KnowledgeBaseMember).where(
            KnowledgeBaseMember.tenant_id == tenant_id, KnowledgeBaseMember.kb_id == kb_id
        ))
        session.add_all([
            KnowledgeBaseMember(
                tenant_id=tenant_id, kb_id=kb_id, user_id=member["user_id"],
                role=member["role"], created_at=timestamp,
            )
            for member in members
        ])


def create_user_atomically(user_id, tenant_id, username, password_hash, role="user", email=None):
    """Insert a user; username uniqueness is scoped to the tenant."""
    with Session(engine) as session, session.begin():
        if config.DATABASE_BACKEND == "sqlite":
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        exists = session.scalar(
            select(User.id).where(
                User.tenant_id == tenant_id,
                func.lower(User.username) == username.lower(),
                User.deleted_at.is_(None),
            )
        )
        if exists:
            return None
        session.add(User(
            id=user_id, tenant_id=tenant_id, username=username, email=email,
            password_hash=password_hash, role=role, created_at=now(), updated_at=now(),
        ))
    return role


def create_tenant_with_admin(tenant_id, tenant_code, tenant_name, user_id, username, password_hash):
    """Atomically create an organization and its first administrator."""
    timestamp = now()
    with Session(engine) as session, session.begin():
        session.add(Tenant(
            id=tenant_id, tenant_code=tenant_code, name=tenant_name,
            status=1, created_at=timestamp, updated_at=timestamp,
        ))
        session.add(User(
            id=user_id, tenant_id=tenant_id, username=username,
            password_hash=password_hash, role="admin", status=1, token_version=1,
            created_at=timestamp, updated_at=timestamp,
        ))


# Create missing tables from the declarative ORM metadata at startup.
init_db()
