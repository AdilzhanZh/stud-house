-- How long a required document stays valid after its issue date (e.g. a
-- certificate accepted only if issued within the last 90 days). NULL means
-- it never expires. Applied at triage time against the AI-extracted issue
-- date, so changing it re-evaluates already-uploaded documents.
ALTER TABLE required_documents ADD COLUMN validity_days INT CHECK (validity_days > 0);

-- AI document check state per uploaded document. Only uploads against a
-- required-document slot are checked; everything else (and every row that
-- existed before this migration) is 'skipped'.
--   pending -> processing -> done | failed | unsupported
-- ai_result holds the model's structured extraction (see
-- domain.DocumentCheckResult).
ALTER TABLE application_documents
    ADD COLUMN ai_status VARCHAR(20) NOT NULL DEFAULT 'skipped'
        CHECK (ai_status IN ('skipped', 'pending', 'processing', 'done', 'failed', 'unsupported')),
    ADD COLUMN ai_attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN ai_claimed_at TIMESTAMPTZ,
    ADD COLUMN ai_checked_at TIMESTAMPTZ,
    ADD COLUMN ai_result JSONB,
    ADD COLUMN ai_error TEXT;

CREATE INDEX idx_application_documents_ai_pending ON application_documents(uploaded_at)
    WHERE ai_status = 'pending';
