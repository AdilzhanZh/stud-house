ALTER TABLE dormitory_required_documents ADD COLUMN document_name VARCHAR(255);
UPDATE dormitory_required_documents drd
SET document_name = rd.name
FROM required_documents rd
WHERE rd.id = drd.document_id;
ALTER TABLE dormitory_required_documents ALTER COLUMN document_name SET NOT NULL;
ALTER TABLE dormitory_required_documents DROP CONSTRAINT uq_dormitory_required_documents_dormitory_document;
ALTER TABLE dormitory_required_documents DROP COLUMN document_id;

ALTER TABLE benefit_required_documents ADD COLUMN document_name VARCHAR(255);
UPDATE benefit_required_documents brd
SET document_name = rd.name
FROM required_documents rd
WHERE rd.id = brd.document_id;
ALTER TABLE benefit_required_documents ALTER COLUMN document_name SET NOT NULL;
ALTER TABLE benefit_required_documents DROP CONSTRAINT uq_benefit_required_documents_benefit_document;
ALTER TABLE benefit_required_documents DROP COLUMN document_id;

DROP TABLE required_documents;
