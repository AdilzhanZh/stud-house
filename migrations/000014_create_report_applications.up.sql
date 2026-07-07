-- Two invariants apply here but can't be expressed as table constraints
-- because they read another table's mutable state (Postgres CHECK/partial
-- index predicates can't reference other tables): (1) application_id must
-- have applications.status = 'approved', and (2) an application can only
-- belong to one reports row whose status = 'pending_committee' at a time.
-- Both are enforced in internal/repository/postgres/report_repo.go via
-- SELECT ... FOR UPDATE on the applications rows before insert.
CREATE TABLE report_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    application_id  UUID NOT NULL REFERENCES applications(id),
    UNIQUE (report_id, application_id)
);

CREATE INDEX idx_report_applications_report_id ON report_applications(report_id);
CREATE INDEX idx_report_applications_application_id ON report_applications(application_id);
