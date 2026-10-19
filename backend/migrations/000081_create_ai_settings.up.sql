-- Admin-editable AI settings (single row). Until an admin saves them, the
-- env vars (ASSISTANT_*, DOCUMENT_CHECK_MODEL) are used. The API key itself
-- stays in the environment and is never stored here.
CREATE TABLE ai_settings (
    singleton                BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    assistant_enabled        BOOLEAN NOT NULL,
    assistant_model          VARCHAR(64) NOT NULL,
    assistant_effort         VARCHAR(16) NOT NULL,
    assistant_daily_limit    INT NOT NULL CHECK (assistant_daily_limit > 0),
    document_checks_enabled  BOOLEAN NOT NULL,
    document_check_model     VARCHAR(64) NOT NULL,
    updated_by               UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
