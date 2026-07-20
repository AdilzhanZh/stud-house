CREATE TABLE application_reapply_blocks (
    student_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    blocked_until TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
