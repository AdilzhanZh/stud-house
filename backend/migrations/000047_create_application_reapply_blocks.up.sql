-- Set when a manager voids an overdue payment (PaymentService.ManagerDecision
-- action=void): the student is barred from submitting a new application
-- until blocked_until. One row per student, overwritten on each new block.
CREATE TABLE application_reapply_blocks (
    student_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    blocked_until TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
