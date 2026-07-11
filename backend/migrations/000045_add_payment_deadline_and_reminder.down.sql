DROP INDEX IF EXISTS idx_payments_deadline;
ALTER TABLE payments DROP COLUMN reminder_sent_at;
ALTER TABLE payments DROP COLUMN deadline;
