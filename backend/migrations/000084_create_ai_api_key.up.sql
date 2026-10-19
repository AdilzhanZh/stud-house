-- An AI provider API key set by an admin from the admin panel. Only the
-- AES-GCM ciphertext is stored (see service.keySealer); the key itself is
-- never returned by the API. When no row exists, the environment's key
-- (OPENROUTER_API_KEY / ANTHROPIC_API_KEY), if any, is used.
CREATE TABLE ai_api_key (
    singleton   BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    provider    VARCHAR(16) NOT NULL CHECK (provider IN ('anthropic', 'openrouter')),
    ciphertext  BYTEA NOT NULL,
    set_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    set_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
