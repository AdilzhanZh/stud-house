-- Template filling (placeholder substitution into an actual .docx/PDF) is
-- out of scope this phase; report_templates only stores a name + the
-- uploaded template's file_url, used later by the export endpoint.
CREATE TABLE report_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    file_url    TEXT NOT NULL,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
