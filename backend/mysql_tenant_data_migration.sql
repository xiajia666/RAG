-- Add tenant isolation to existing RAG data tables.
-- Existing records are assigned to the default tenant created during the users migration.
-- This file contains one-time ALTER statements; do not execute it again after they succeed.
-- The current rag_db was verified as migrated on 2026-09-26.

SET @legacy_tenant_id = '00000000000000000000000000000001';

-- Composite referenced key for tenant-scoped foreign keys.
ALTER TABLE users
  DROP INDEX username,
  ADD UNIQUE KEY uk_tenant_username (tenant_id, username),
  ADD UNIQUE KEY uk_users_tenant_id (tenant_id, id);

ALTER TABLE knowledge_bases
  ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
UPDATE knowledge_bases SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
ALTER TABLE knowledge_bases
  MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD UNIQUE KEY uk_kb_tenant_id (tenant_id, id),
  ADD CONSTRAINT fk_kb_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  ADD CONSTRAINT fk_kb_created_by FOREIGN KEY (tenant_id, created_by) REFERENCES users(tenant_id, id);

ALTER TABLE documents
  ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
UPDATE documents d
JOIN knowledge_bases k ON k.id = d.kb_id
SET d.tenant_id = k.tenant_id
WHERE d.tenant_id IS NULL;
UPDATE documents SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
ALTER TABLE documents
  MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD UNIQUE KEY uk_documents_tenant_id (tenant_id, id),
  ADD UNIQUE KEY uk_documents_tenant_id_kb (tenant_id, id, kb_id),
  ADD CONSTRAINT fk_documents_tenant_kb
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE chunks
  ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
UPDATE chunks c
JOIN documents d ON d.id = c.doc_id
SET c.tenant_id = d.tenant_id
WHERE c.tenant_id IS NULL;
UPDATE chunks SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
ALTER TABLE chunks
  MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD KEY idx_chunks_tenant_kb (tenant_id, kb_id),
  ADD CONSTRAINT fk_chunks_tenant_document
    FOREIGN KEY (tenant_id, doc_id, kb_id)
    REFERENCES documents(tenant_id, id, kb_id) ON DELETE CASCADE;

ALTER TABLE sessions
  ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
UPDATE sessions s
JOIN users u ON u.id = s.user_id
SET s.tenant_id = u.tenant_id
WHERE s.tenant_id IS NULL;
UPDATE sessions SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
ALTER TABLE sessions
  MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD UNIQUE KEY uk_sessions_tenant_id (tenant_id, id),
  ADD KEY idx_sessions_tenant_user (tenant_id, user_id),
  ADD CONSTRAINT fk_sessions_tenant_user
    FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id),
  ADD CONSTRAINT fk_sessions_tenant_kb
    FOREIGN KEY (tenant_id, kb_id) REFERENCES knowledge_bases(tenant_id, id) ON DELETE CASCADE;

ALTER TABLE messages
  ADD COLUMN tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER id;
UPDATE messages m
JOIN sessions s ON s.id = m.session_id
SET m.tenant_id = s.tenant_id
WHERE m.tenant_id IS NULL;
UPDATE messages SET tenant_id = @legacy_tenant_id WHERE tenant_id IS NULL;
ALTER TABLE messages
  MODIFY tenant_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  ADD KEY idx_messages_tenant_session (tenant_id, session_id),
  ADD CONSTRAINT fk_messages_tenant_session
    FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE;
