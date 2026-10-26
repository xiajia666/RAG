-- Unified MySQL script for the RAG project.
-- Fresh deployment: execute the active section below.
-- Existing legacy database: the historical one-time migration is preserved at the end
-- as comments; do not rerun it if tenant migration has already succeeded.

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


-- -----------------------------------------------------------------------------
-- HISTORICAL ONE-TIME TENANT MIGRATION (reference only; intentionally disabled)
-- The former migration was not idempotent (for example, it dropped the username
-- index unconditionally). The current remote database completed it on 2026-09-26.
-- Keep this section for SQL history; do not uncomment/run against an already
-- migrated database.
-- -----------------------------------------------------------------------------
-- -- Add tenant isolation to existing RAG data tables.
-- -- Existing records are assigned to the default tenant created during the users migration.
-- -- This file contains one-time ALTER statements; do not execute it again after they succeed.
-- -- The current rag_db was verified as migrated on 2026-09-26.
--
-- SET @legacy_tenant_id = '00000000000000000000000000000001';
--
-- -- Composite referenced key for tenant-scoped foreign keys.
-- ALTER TABLE users
--   DROP INDEX username,
--   ADD UNIQUE KEY uk_tenant_username (tenant_id, username),
--   ADD UNIQUE KEY uk_users_tenant_id (tenant_id, id);
--
-- ALTER TABLE knowledge_bases
--   ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
-- UPDATE knowledge_bases SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
-- ALTER TABLE knowledge_bases
--   MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
--   ADD UNIQUE KEY uk_kb_tenant_id (tenant_id, id),
--   ADD CONSTRAINT fk_kb_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
--   ADD CONSTRAINT fk_kb_created_by FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id);
--
-- ALTER TABLE documents
--   ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
-- UPDATE documents d
-- JOIN knowledge_bases k ON k.id = d.kb_id
-- SET d.tenant_id = k.tenant_id
-- WHERE d.tenant_id IS NULL;
-- UPDATE documents SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
-- ALTER TABLE documents
--   MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
--   ADD UNIQUE KEY uk_documents_tenant_id (tenant_id, id),
--   ADD UNIQUE KEY uk_documents_tenant_id_kb (tenant_id, id, kb_id),
--   ADD CONSTRAINT fk_documents_tenant_kb
--     FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE;
--
-- ALTER TABLE chunks
--   ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
-- UPDATE chunks c
-- JOIN documents d ON d.id = c.doc_id
-- SET c.tenant_id = d.tenant_id
-- WHERE c.tenant_id IS NULL;
-- UPDATE chunks SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
-- ALTER TABLE chunks
--   MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
--   ADD KEY idx_chunks_tenant_kb (tenant_id, kb_id),
--   ADD CONSTRAINT fk_chunks_tenant_document
--     FOREIGN KEY (tenant_id, doc_id, kb_id)
--     REFERENCES documents(tenant_id, id, kb_id) ON DELETE CASCADE;
--
-- ALTER TABLE sessions
--   ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
-- UPDATE sessions s
-- JOIN users u ON u.id = s.user_id
-- SET s.tenant_id = u.tenant_id
-- WHERE s.tenant_id IS NULL;
-- UPDATE sessions SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
-- ALTER TABLE sessions
--   MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
--   ADD UNIQUE KEY uk_sessions_tenant_id (tenant_id, id),
--   ADD KEY idx_sessions_tenant_user (tenant_id, user_id),
--   ADD CONSTRAINT fk_sessions_tenant_user
--     FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id),
--   ADD CONSTRAINT fk_sessions_tenant_kb
--     FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE;
--
-- ALTER TABLE messages
--   ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
-- UPDATE messages m
-- JOIN sessions s ON s.id = m.session_id
-- SET m.tenant_id = s.tenant_id
-- WHERE m.tenant_id IS NULL;
-- UPDATE messages SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
-- ALTER TABLE messages
--   MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
--   ADD KEY idx_messages_tenant_session (tenant_id, session_id),
--   ADD CONSTRAINT fk_messages_tenant_session
--     FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE;
