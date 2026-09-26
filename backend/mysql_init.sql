-- RAG schema bootstrap for MySQL 5.7.6+ / MySQL 8 / MariaDB.
-- Before running, replace BOTH occurrences of REPLACE_WITH_A_LONG_RANDOM_PASSWORD
-- with the same unique password. Restrict 'rag_app'@'%' to your backend's fixed
-- source IP when possible. TLS is required for the application account.

CREATE DATABASE IF NOT EXISTS rag_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'rag_app'@'%'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD'
  REQUIRE SSL;

ALTER USER 'rag_app'@'%'
  IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD'
  REQUIRE SSL;

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX
  ON rag_db.* TO 'rag_app'@'%';

USE rag_db;

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(32) PRIMARY KEY,
  tenant_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_bases (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
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
  CONSTRAINT fk_documents_kb
    FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_tenant_kb
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chunks (
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
  CONSTRAINT fk_chunks_document
    FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_chunks_tenant_document
    FOREIGN KEY (tenant_id, doc_id, kb_id)
    REFERENCES documents(tenant_id, id, kb_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(32) PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  kb_id VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  created_at VARCHAR(40) NOT NULL,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_kb (kb_id),
  UNIQUE KEY uk_sessions_tenant_id (tenant_id, id),
  CONSTRAINT fk_sessions_kb
    FOREIGN KEY (kb_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_tenant_user
    FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id),
  CONSTRAINT fk_sessions_tenant_kb
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(32) NOT NULL,
  session_id VARCHAR(32) NOT NULL,
  role VARCHAR(16) NOT NULL,
  content LONGTEXT NOT NULL,
  sources LONGTEXT NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  INDEX idx_messages_session (session_id),
  INDEX idx_messages_tenant_session (tenant_id, session_id),
  CONSTRAINT fk_messages_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_tenant_session
    FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id VARCHAR(32) NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value LONGTEXT NOT NULL,
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (tenant_id, setting_key),
  CONSTRAINT fk_tenant_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_base_access (
  tenant_id VARCHAR(32) NOT NULL,
  kb_id VARCHAR(32) NOT NULL,
  access_mode VARCHAR(16) NOT NULL DEFAULT 'tenant',
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (tenant_id, kb_id),
  CONSTRAINT fk_kb_access_kb
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_base_members (
  tenant_id VARCHAR(32) NOT NULL,
  kb_id VARCHAR(32) NOT NULL,
  user_id VARCHAR(32) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'reader',
  created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (tenant_id, kb_id, user_id),
  CONSTRAINT fk_kb_members_kb
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT fk_kb_members_user
    FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
