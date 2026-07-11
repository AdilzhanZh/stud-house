ALTER TABLE application_documents DROP CONSTRAINT chk_application_documents_name_source;

ALTER TABLE application_documents DROP COLUMN dormitory_required_document_id;

ALTER TABLE application_documents ADD CONSTRAINT chk_application_documents_name_source CHECK (
    (benefit_required_document_id IS NOT NULL AND document_name IS NULL)
    OR (benefit_required_document_id IS NULL AND document_name IS NOT NULL)
);

DROP TABLE dormitory_required_documents;
