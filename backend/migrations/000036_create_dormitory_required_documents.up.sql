CREATE TABLE dormitory_required_documents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dormitory_id   UUID NOT NULL REFERENCES dormitories(id) ON DELETE CASCADE,
    document_name  VARCHAR(255) NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dormitory_required_documents_dormitory_id ON dormitory_required_documents(dormitory_id);

ALTER TABLE application_documents
    ADD COLUMN dormitory_required_document_id UUID REFERENCES dormitory_required_documents(id);

ALTER TABLE application_documents DROP CONSTRAINT chk_application_documents_name_source;

-- A document row is tied to exactly one of: a benefit's required document,
-- a dormitory's required document, or a generic free-form name.
ALTER TABLE application_documents ADD CONSTRAINT chk_application_documents_name_source CHECK (
    (CASE WHEN benefit_required_document_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN dormitory_required_document_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN document_name IS NOT NULL THEN 1 ELSE 0 END) = 1
);
