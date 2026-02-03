-- Create conversation table
CREATE TABLE IF NOT EXISTS conversation (
    id BIGSERIAL PRIMARY KEY,
    workspace_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    title VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_conversation_workspace FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
    CONSTRAINT fk_conversation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for conversation
CREATE INDEX IF NOT EXISTS idx_conversation_workspace ON conversation(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversation_user ON conversation(user_id);

-- Create conversation_message table
CREATE TABLE IF NOT EXISTS conversation_message (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversation(id) ON DELETE CASCADE
);

-- Create index for conversation_message
CREATE INDEX IF NOT EXISTS idx_conversation_message_conversation ON conversation_message(conversation_id);
