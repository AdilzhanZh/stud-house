DROP INDEX IF EXISTS idx_application_documents_ai_pending;
ALTER TABLE application_documents
    DROP COLUMN ai_error,
    DROP COLUMN ai_result,
    DROP COLUMN ai_checked_at,
    DROP COLUMN ai_claimed_at,
    DROP COLUMN ai_attempts,
    DROP COLUMN ai_status;
ALTER TABLE required_documents DROP COLUMN validity_days;
