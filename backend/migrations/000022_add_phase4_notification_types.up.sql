-- Contract/payment/exit-request notifications don't fit the existing
-- notification_type values, so three more are added the same additive way
-- 'report_review' was in phase 3.
ALTER TYPE notification_type ADD VALUE 'contract_sent';
ALTER TYPE notification_type ADD VALUE 'payment_update';
ALTER TYPE notification_type ADD VALUE 'exit_request_update';
