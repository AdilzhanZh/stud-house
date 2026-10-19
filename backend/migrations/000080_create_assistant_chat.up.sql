-- In-app AI assistant conversations. Messages are stored exactly as sent to
-- and received from the Claude API (content = one Messages API message,
-- tool calls and thinking blocks included) and only ever appended: the API
-- rejects replayed thinking blocks whose earlier history was edited.
-- role_key pins the conversation to the tool set and system prompt it was
-- started with; a user whose role changes gets a fresh conversation.
CREATE TABLE assistant_conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_key    VARCHAR(64) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_conversations_user ON assistant_conversations(user_id, updated_at DESC);

-- display_text is what the chat UI shows: the user's own words, or the
-- assistant's final answer. Tool-call round trips have none.
CREATE TABLE assistant_messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
    seq              INT NOT NULL,
    role             VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
    content          JSONB NOT NULL,
    display_text     TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, seq)
);
