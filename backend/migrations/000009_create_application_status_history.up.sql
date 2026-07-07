-- from_status is nullable: the very first row (application creation) has no
-- "from" state.
CREATE TABLE application_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    from_status     application_status,
    to_status       application_status NOT NULL,
    comment         TEXT,
    changed_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_status_history_application_id ON application_status_history(application_id);
