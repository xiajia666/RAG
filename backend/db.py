"""SQLite/MySQL storage layer and application schema initialization."""
import re
import ssl
import sqlite3
import threading
from datetime import datetime

import config

_lock = threading.Lock()


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _connect():
    if config.DATABASE_BACKEND == "mysql":
        try:
            import pymysql
            from pymysql.cursors import DictCursor
        except ImportError as exc:
            raise RuntimeError("MySQL 模式缺少 PyMySQL，请安装 backend/requirements.txt") from exc
        if not config.MYSQL_PASSWORD:
            raise RuntimeError("MySQL 模式未配置 MYSQL_PASSWORD")
        options = None
        if config.MYSQL_SSL:
            if config.MYSQL_SSL_VERIFY:
                options = ssl.create_default_context(cafile=config.MYSQL_SSL_CA or None)
            else:
                options = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                options.check_hostname = False
                options.verify_mode = ssl.CERT_NONE
        return pymysql.connect(
            host=config.MYSQL_HOST,
            port=config.MYSQL_PORT,
            user=config.MYSQL_USER,
            password=config.MYSQL_PASSWORD,
            database=config.MYSQL_DATABASE,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=False,
            ssl=options,
            connect_timeout=8,
        )
    if config.DATABASE_BACKEND != "sqlite":
        raise RuntimeError(f"不支持的 DATABASE_BACKEND: {config.DATABASE_BACKEND}")
    conn = sqlite3.connect(config.DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    tenant_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    password_hash TEXT NOT NULL,
    nickname TEXT,
    avatar TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    status INTEGER NOT NULL DEFAULT 1,
    department_id TEXT,
    last_login_at TEXT,
    last_login_ip TEXT,
    token_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, username),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id)
);
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    kb_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE (tenant_id, id, kb_id),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    kb_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id, doc_id, kb_id) REFERENCES documents(tenant_id, id, kb_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kb_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id),
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (tenant_id, setting_key),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chunks_tenant_kb ON chunks(tenant_id, kb_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_kb ON documents(tenant_id, kb_id);
CREATE INDEX IF NOT EXISTS idx_sessions_tenant_user ON sessions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_session ON messages(tenant_id, session_id);
"""

MYSQL_SCHEMA = (
    """CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(32) PRIMARY KEY,
        tenant_code VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        status TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(32) PRIMARY KEY,
        tenant_id VARCHAR(32) NOT NULL,
        username VARCHAR(191) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(32) NULL,
        password_hash VARCHAR(255) NOT NULL,
        nickname VARCHAR(64) NULL,
        avatar VARCHAR(512) NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        status TINYINT NOT NULL DEFAULT 1,
        department_id VARCHAR(32) NULL,
        last_login_at DATETIME NULL,
        last_login_ip VARCHAR(64) NULL,
        token_version INT NOT NULL DEFAULT 1,
        created_at VARCHAR(40) NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at DATETIME NULL,
        UNIQUE KEY uk_users_tenant_id (tenant_id, id),
        UNIQUE KEY uk_tenant_username (tenant_id, username),
        CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS knowledge_bases (
        id VARCHAR(32) PRIMARY KEY,
        tenant_id VARCHAR(32) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        created_by VARCHAR(32) NULL,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_kb_created_at (created_at),
        UNIQUE KEY uk_kb_tenant_id (tenant_id, id),
        CONSTRAINT fk_kb_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        CONSTRAINT fk_kb_created_by FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(32) PRIMARY KEY,
        tenant_id VARCHAR(32) NOT NULL,
        kb_id VARCHAR(32) NOT NULL,
        filename VARCHAR(512) NOT NULL,
        size BIGINT NOT NULL DEFAULT 0,
        chunk_count INT NOT NULL DEFAULT 0,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_documents_kb (kb_id),
        UNIQUE KEY uk_documents_tenant_id (tenant_id, id),
        UNIQUE KEY uk_documents_tenant_id_kb (tenant_id, id, kb_id),
        CONSTRAINT fk_documents_kb FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        CONSTRAINT fk_documents_tenant_kb FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS chunks (
        id VARCHAR(32) PRIMARY KEY,
        tenant_id VARCHAR(32) NOT NULL,
        doc_id VARCHAR(32) NOT NULL,
        kb_id VARCHAR(32) NOT NULL,
        chunk_index INT NOT NULL,
        content LONGTEXT NOT NULL,
        embedding LONGBLOB NULL,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_chunks_kb (kb_id),
        INDEX idx_chunks_doc (doc_id),
        INDEX idx_chunks_tenant_kb (tenant_id, kb_id),
        CONSTRAINT fk_chunks_document FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
        CONSTRAINT fk_chunks_tenant_doc FOREIGN KEY (tenant_id, doc_id, kb_id) REFERENCES documents(tenant_id, id, kb_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(32) PRIMARY KEY,
        tenant_id VARCHAR(32) NOT NULL,
        user_id VARCHAR(32) NOT NULL,
        kb_id VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '',
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_sessions_user (user_id),
        INDEX idx_sessions_kb (kb_id),
        UNIQUE KEY uk_sessions_tenant_id (tenant_id, id),
        CONSTRAINT fk_sessions_kb FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        CONSTRAINT fk_sessions_tenant_user FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id),
        CONSTRAINT fk_sessions_tenant_kb FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS messages (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        tenant_id VARCHAR(32) NOT NULL,
        session_id VARCHAR(32) NOT NULL,
        role VARCHAR(16) NOT NULL,
        content LONGTEXT NOT NULL,
        sources LONGTEXT NOT NULL,
        created_at VARCHAR(40) NOT NULL,
        INDEX idx_messages_session (session_id),
        CONSTRAINT fk_messages_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_messages_tenant_session FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
    """CREATE TABLE IF NOT EXISTS tenant_settings (
        tenant_id VARCHAR(32) NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        setting_value LONGTEXT NOT NULL,
        updated_at VARCHAR(40) NOT NULL,
        PRIMARY KEY (tenant_id, setting_key),
        CONSTRAINT fk_tenant_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci""",
)


def init_db():
    with _lock:
        conn = _connect()
        try:
            if config.DATABASE_BACKEND == "mysql":
                with conn.cursor() as cur:
                    for statement in MYSQL_SCHEMA:
                        cur.execute(statement)
            else:
                conn.executescript(SCHEMA)
            conn.commit()
        finally:
            conn.close()


def _run(conn, sql, params=()):
    if config.DATABASE_BACKEND == "mysql":
        sql = re.sub(r"\?", "%s", sql)
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur
    return conn.execute(sql, params)


def query(sql, params=()):
    conn = _connect()
    try:
        return [dict(row) for row in _run(conn, sql, params).fetchall()]
    finally:
        conn.close()


def query_one(sql, params=()):
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql, params=()):
    conn = _connect()
    try:
        cur = _run(conn, sql, params)
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def executemany(sql, params_seq):
    conn = _connect()
    try:
        if config.DATABASE_BACKEND == "mysql":
            with conn.cursor() as cur:
                cur.executemany(re.sub(r"\?", "%s", sql), params_seq)
        else:
            conn.executemany(sql, params_seq)
        conn.commit()
    finally:
        conn.close()


def set_tenant_setting(tenant_id, key, value):
    timestamp = now()
    if config.DATABASE_BACKEND == "mysql":
        execute(
            "INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, updated_at) "
            "VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)",
            (tenant_id, key, value, timestamp),
        )
    else:
        execute(
            "INSERT INTO tenant_settings (tenant_id, setting_key, setting_value, updated_at) "
            "VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id, setting_key) DO UPDATE SET "
            "setting_value = excluded.setting_value, updated_at = excluded.updated_at",
            (tenant_id, key, value, timestamp),
        )


def create_user_atomically(user_id, tenant_id, username, password_hash, role="user"):
    """Insert a user; username uniqueness is scoped to the tenant."""
    conn = _connect()
    try:
        if config.DATABASE_BACKEND == "mysql":
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE tenant_id = %s AND LOWER(username) = LOWER(%s) AND deleted_at IS NULL", (tenant_id, username))
                if cur.fetchone():
                    return None
                cur.execute(
                    "INSERT INTO users (id, tenant_id, username, password_hash, role, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
                    (user_id, tenant_id, username, password_hash, role, now()),
                )
            conn.commit()
        else:
            conn.execute("BEGIN IMMEDIATE")
            if conn.execute("SELECT id FROM users WHERE tenant_id = ? AND LOWER(username) = LOWER(?) AND deleted_at IS NULL", (tenant_id, username)).fetchone():
                conn.rollback()
                return None
            conn.execute(
                "INSERT INTO users (id, tenant_id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, tenant_id, username, password_hash, role, now()),
            )
            conn.commit()
        return role
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_tenant_with_admin(tenant_id, tenant_code, tenant_name, user_id, username, password_hash):
    """Atomically create an organization and its first administrator."""
    conn = _connect()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        if config.DATABASE_BACKEND == "mysql":
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO tenants (id, tenant_code, name, status, created_at, updated_at) VALUES (%s, %s, %s, 1, %s, %s)",
                    (tenant_id, tenant_code, tenant_name, timestamp, timestamp),
                )
                cur.execute(
                    "INSERT INTO users (id, tenant_id, username, password_hash, role, status, token_version, created_at) VALUES (%s, %s, %s, %s, 'admin', 1, 1, %s)",
                    (user_id, tenant_id, username, password_hash, now()),
                )
        else:
            conn.execute(
                "INSERT INTO tenants (id, tenant_code, name, status, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
                (tenant_id, tenant_code, tenant_name, timestamp, timestamp),
            )
            conn.execute(
                "INSERT INTO users (id, tenant_id, username, password_hash, role, status, token_version, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', 1, 1, ?, ?)",
                (user_id, tenant_id, username, password_hash, now(), timestamp),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# Initialize schema at startup using the selected backend.
init_db()
