-- Shared, reusable document catalog: instead of each benefit/dormitory
-- typing its own free-form "required document" name, admins pick from one
-- shared list here, so the same document (e.g. "3х4 фото") isn't re-typed
-- (and re-worded) in every benefit and dormitory that needs it.
CREATE TABLE required_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- benefit_required_documents: swap the free-text document_name for a
-- document_id pointing into the shared catalog. Backfill catalog entries
-- from whatever free-text names already exist before dropping the column.
INSERT INTO required_documents (name)
SELECT DISTINCT document_name FROM benefit_required_documents;

ALTER TABLE benefit_required_documents ADD COLUMN document_id UUID REFERENCES required_documents(id);

UPDATE benefit_required_documents brd
SET document_id = rd.id
FROM required_documents rd
WHERE rd.name = brd.document_name;

ALTER TABLE benefit_required_documents ALTER COLUMN document_id SET NOT NULL;
ALTER TABLE benefit_required_documents DROP COLUMN document_name;
ALTER TABLE benefit_required_documents ADD CONSTRAINT uq_benefit_required_documents_benefit_document UNIQUE (benefit_id, document_id);
CREATE INDEX idx_benefit_required_documents_document_id ON benefit_required_documents(document_id);

-- dormitory_required_documents has no rows yet (feature just added), so no
-- backfill is needed.
ALTER TABLE dormitory_required_documents ADD COLUMN document_id UUID REFERENCES required_documents(id);
ALTER TABLE dormitory_required_documents ALTER COLUMN document_id SET NOT NULL;
ALTER TABLE dormitory_required_documents DROP COLUMN document_name;
ALTER TABLE dormitory_required_documents ADD CONSTRAINT uq_dormitory_required_documents_dormitory_document UNIQUE (dormitory_id, document_id);
CREATE INDEX idx_dormitory_required_documents_document_id ON dormitory_required_documents(document_id);
