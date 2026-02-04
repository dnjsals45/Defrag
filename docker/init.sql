-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    nickname VARCHAR(100) NOT NULL,
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'local',
    provider_id VARCHAR(255),
    profile_image VARCHAR(500),
    password_reset_token VARCHAR(255),
    password_reset_expiry TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Index for social login lookups
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(auth_provider, provider_id) WHERE deleted_at IS NULL;

-- 2. workspace
CREATE TABLE IF NOT EXISTS workspace (
    id BIGSERIAL PRIMARY KEY,
    owner_id BIGINT NOT NULL REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'personal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 3. workspace_member
CREATE TABLE IF NOT EXISTS workspace_member (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    workspace_id BIGINT NOT NULL REFERENCES workspace(id),
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 4. user_connection (개인 OAuth)
CREATE TABLE IF NOT EXISTS user_connection (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    installation_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(user_id, provider)
);

-- 5. workspace_integration (팀 OAuth)
CREATE TABLE IF NOT EXISTS workspace_integration (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id),
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    config JSONB,
    connected_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(workspace_id, provider)
);

-- 6. context_item
CREATE TABLE IF NOT EXISTS context_item (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id),
    author_id BIGINT REFERENCES users(id),
    source_type VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    title VARCHAR(500),
    content TEXT NOT NULL,
    metadata JSONB,
    source_url TEXT,
    importance_score DECIMAL(4, 2) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(workspace_id, source_type, external_id)
);

-- 7. vector_data (supports chunking - multiple embeddings per item)
CREATE TABLE IF NOT EXISTS vector_data (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES context_item(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0,
    chunk_content TEXT,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE(item_id, chunk_index)
);

-- 8. item_relation
CREATE TABLE IF NOT EXISTS item_relation (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES context_item(id),
    target_id BIGINT NOT NULL REFERENCES context_item(id),
    relation_type VARCHAR(50) NOT NULL,
    score DECIMAL(4, 2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 9. conversation
CREATE TABLE IF NOT EXISTS conversation (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 10. conversation_message
CREATE TABLE IF NOT EXISTS conversation_message (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversation(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_context_item_workspace ON context_item(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_context_item_source ON context_item(workspace_id, source_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_member_workspace ON workspace_member(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_member_user ON workspace_member(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vector_embedding ON vector_data USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_item_relation_source ON item_relation(source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_relation_target ON item_relation(target_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_workspace ON conversation(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_user ON conversation(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversation_message_conversation ON conversation_message(conversation_id);

-- 11. workspace_invitation (초대 시스템)
CREATE TABLE IF NOT EXISTS workspace_invitation (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL REFERENCES workspace(id),
    inviter_id BIGINT NOT NULL REFERENCES users(id),
    invitee_id BIGINT REFERENCES users(id),
    invitee_email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP NOT NULL,
    responded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitation_workspace ON workspace_invitation(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_invitation_invitee ON workspace_invitation(invitee_id) WHERE deleted_at IS NULL AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workspace_invitation_email ON workspace_invitation(invitee_email) WHERE deleted_at IS NULL AND status = 'pending';
