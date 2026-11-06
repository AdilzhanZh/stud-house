-- The AI features are now configured in code (provider, model, limits) with
-- the API key in the environment (ALEM_API_KEY). The only thing an admin
-- still decides is who may use the assistant.
DROP TABLE IF EXISTS ai_api_key;
DROP TABLE IF EXISTS ai_settings;

-- audiences: student, staff, manager, committee, admin (see
-- domain.AssistantAudience). No row = everyone may use it.
CREATE TABLE assistant_access (
    singleton   BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    audiences   TEXT[] NOT NULL,
    updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
