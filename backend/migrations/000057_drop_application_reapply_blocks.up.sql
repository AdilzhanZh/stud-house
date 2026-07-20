-- application_reapply_blocks existed solely to bar a student from
-- reapplying after a manager voided their overdue payment
-- (PaymentService.ManagerDecision, removed alongside the payments table in
-- migration 000056) — nothing writes to it anymore.
DROP TABLE application_reapply_blocks;
