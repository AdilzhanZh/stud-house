-- Singleton table: exactly one system-wide contract template row, its id
-- pinned by the CHECK constraint (same pattern as petition_template /
-- protocol_template). Unlike those, the contract is a real multi-page paper
-- document, so content is stored as an ordered JSON array of per-page HTML
-- fragments rather than a single content_html column — see
-- domain.ContractTemplate.
CREATE TABLE contract_template (
    id         UUID PRIMARY KEY,
    pages      JSONB NOT NULL DEFAULT '[]',
    updated_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT contract_template_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);
