-- Tracks whether the "deadline approaching" reminder has already gone out
-- for this contract, so it's only sent once per contract.
ALTER TABLE contracts ADD COLUMN reminder_sent_at TIMESTAMPTZ;
