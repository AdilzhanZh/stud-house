DROP TABLE IF EXISTS assistant_access;

CREATE TABLE ai_settings (
    singleton                BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    assistant_enabled        BOOLEAN NOT NULL,
    assistant_model          VARCHAR(128) NOT NULL,
    assistant_effort         VARCHAR(16) NOT NULL,
    assistant_daily_limit    INT NOT NULL CHECK (assistant_daily_limit > 0),
    document_checks_enabled  BOOLEAN NOT NULL,
    document_check_model     VARCHAR(128) NOT NULL,
    updated_by               UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_api_key (
    singleton   BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    provider    VARCHAR(16) NOT NULL CHECK (provider IN ('anthropic', 'openrouter')),
    ciphertext  BYTEA NOT NULL,
    set_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    set_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
