-- Contract templates become per-language: dormitory contracts are always
-- prepared in both Kazakh and Russian, so one row per language replaces the
-- previous single system-wide row (migration 000064). Safe to drop and
-- recreate — this table was only ever written to during this feature's own
-- development, no real admin content exists yet.
DROP TABLE contract_template;

CREATE TABLE contract_template (
    language   TEXT PRIMARY KEY,
    pages      JSONB NOT NULL DEFAULT '[]',
    updated_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contract_template_language_check CHECK (language IN ('kk', 'ru'))
);
