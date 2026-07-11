-- Mirrors contract_status's 'awaiting_manager_decision' (migration 000023):
-- a payment past its deadline is only flagged for a manager to void or
-- extend, never auto-rejected by the background job itself.
ALTER TYPE payment_status ADD VALUE 'awaiting_manager_decision';
