"""Create the RAG MySQL database and a least-privilege application account.

Run from the project root with: python backend/provision_mysql.py
The MySQL root password is requested with terminal echo disabled and is never saved.
"""
import argparse
import getpass
import os
import re
import secrets
import ssl
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"
DB_HOST = "123.57.80.38"
DATABASE = "rag_db"
APP_USER = "rag_app"
APP_HOST = "%"


def quote_identifier(value):
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", value):
        raise ValueError("数据库名和用户名只能包含英文字母、数字及下划线")
    return f"`{value}`"


def set_env_values(values):
    old = ENV_FILE.read_text(encoding="utf-8") if ENV_FILE.exists() else ""
    lines = old.splitlines()
    for key, value in values.items():
        prefix = f"{key}="
        lines = [line for line in lines if not line.startswith(prefix)]
        lines.append(f"{key}={value}")
    ENV_FILE.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    os.chmod(ENV_FILE, 0o600)


def main():
    parser = argparse.ArgumentParser(description="Provision a least-privilege MySQL account and RAG tables.")
    parser.add_argument("--port", type=int, default=3306, help="MySQL TCP port (default: 3306)")
    parser.add_argument("--host", default=DB_HOST, help="MySQL host")
    parser.add_argument("--ssl-ca", help="Trusted PEM CA certificate for a private/self-signed MySQL TLS certificate")
    args = parser.parse_args()
    root_password = getpass.getpass(f"MySQL root password for {args.host}: ")
    if not root_password:
        raise SystemExit("未输入 root 密码，未做任何修改。")

    app_password = secrets.token_urlsafe(36)
    tls = ssl.create_default_context(cafile=args.ssl_ca)
    try:
        conn = pymysql.connect(
            host=args.host,
            port=args.port,
            user="root",
            password=root_password,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            ssl=tls,
            connect_timeout=10,
        )
    except pymysql.MySQLError as exc:
        reason = str(exc.args[1]) if len(exc.args) > 1 else exc.__class__.__name__
        raise SystemExit(
            f"无法连接到 {args.host}:{args.port}（MySQL 错误 {exc.args[0] if exc.args else 'unknown'}：{reason}）。"
            "未创建数据库或账号，且未修改 .env。请确认端口、防火墙白名单和 MySQL 远程访问设置。"
        ) from None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT VERSION() AS version")
            server_version = cur.fetchone()["version"]
            cur.execute(f"CREATE DATABASE IF NOT EXISTS {quote_identifier(DATABASE)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            cur.execute(
                "CREATE USER IF NOT EXISTS %s@%s IDENTIFIED BY %s REQUIRE SSL",
                (APP_USER, APP_HOST, app_password),
            )
            cur.execute(
                "ALTER USER %s@%s IDENTIFIED BY %s REQUIRE SSL",
                (APP_USER, APP_HOST, app_password),
            )
            cur.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX ON {quote_identifier(DATABASE)}.* TO %s@%s",
                (APP_USER, APP_HOST),
            )
    finally:
        conn.close()

    # Configure the application account, never the MySQL root account.
    values = {
        "DATABASE_BACKEND": "mysql",
        "MYSQL_HOST": args.host,
        "MYSQL_PORT": str(args.port),
        "MYSQL_DATABASE": DATABASE,
        "MYSQL_USER": APP_USER,
        "MYSQL_PASSWORD": app_password,
        "MYSQL_SSL": "true",
        "MYSQL_SSL_CA": args.ssl_ca or "",
    }
    os.environ.update(values)

    # Importing db initializes all RAG tables via the application account.
    import sys
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import db

    tables = db.query("SHOW TABLES")
    set_env_values(values)
    print(f"MySQL {server_version}: 已创建数据库 {DATABASE}，应用用户 {APP_USER}，并初始化 {len(tables)} 张 RAG 数据表。")
    print("连接配置已写入项目根目录 .env；root 密码未保存。")


if __name__ == "__main__":
    main()
