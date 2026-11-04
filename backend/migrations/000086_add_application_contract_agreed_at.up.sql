-- When the student agreed to the contract in the application wizard's final
-- step. NULL only on applications submitted before that step existed: those
-- still go through the old post-protocol contract response.
ALTER TABLE applications ADD COLUMN contract_agreed_at TIMESTAMPTZ;
