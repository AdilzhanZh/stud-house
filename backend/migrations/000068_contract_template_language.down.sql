DROP TABLE contract_template;

CREATE TABLE contract_template (
    id         UUID PRIMARY KEY,
    pages      JSONB NOT NULL DEFAULT '[]',
    updated_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contract_template_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);
