-- Payment.deadline mirrors contracts.response_deadline: the manager has this
-- long to confirm/reject a payment before it's flagged for a manager
-- decision (see migration 000046 and PaymentService.FlagOverduePayments).
-- Existing rows get a synthetic deadline of created_at + 7 days.
ALTER TABLE payments ADD COLUMN deadline TIMESTAMPTZ;
UPDATE payments SET deadline = created_at + INTERVAL '7 days' WHERE deadline IS NULL;
ALTER TABLE payments ALTER COLUMN deadline SET NOT NULL;

ALTER TABLE payments ADD COLUMN reminder_sent_at TIMESTAMPTZ;

CREATE INDEX idx_payments_deadline ON payments(deadline);
