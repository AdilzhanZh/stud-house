-- Singleton table: exactly one system-wide petition template row, its id
-- pinned by the CHECK constraint. There's no per-dormitory or per-manager
-- variant (unlike report_templates) — see domain.PetitionTemplate.
CREATE TABLE petition_template (
    id           UUID PRIMARY KEY,
    content_html TEXT NOT NULL,
    updated_by   UUID NOT NULL REFERENCES users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT petition_template_singleton CHECK (id = '00000000-0000-0000-0000-000000000001')
);
