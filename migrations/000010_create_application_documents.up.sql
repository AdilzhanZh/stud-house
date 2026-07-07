-- A document row is either tied to a specific benefit's required document
-- (benefit_required_document_id) or is a generic upload (document_name) —
-- never both, never neither.
CREATE TABLE application_documents (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id                UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    benefit_required_document_id  UUID REFERENCES benefit_required_documents(id),
    document_name                 VARCHAR(255),
    file_url                      TEXT NOT NULL,
    uploaded_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_application_documents_name_source CHECK (
        (benefit_required_document_id IS NOT NULL AND document_name IS NULL)
        OR (benefit_required_document_id IS NULL AND document_name IS NOT NULL)
    )
);

CREATE INDEX idx_application_documents_application_id ON application_documents(application_id);
