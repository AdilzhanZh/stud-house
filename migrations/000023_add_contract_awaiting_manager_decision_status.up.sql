-- Phase 4's "response_deadline passed -> auto expired + application
-- rejected" logic was wrong per spec: expiry must go through a manager.
-- This intermediate status lets the background job/endpoint only flag
-- overdue contracts, leaving the actual expire-or-extend decision to
-- PATCH /contracts/{id}/manager-decision.
ALTER TYPE contract_status ADD VALUE 'awaiting_manager_decision';
