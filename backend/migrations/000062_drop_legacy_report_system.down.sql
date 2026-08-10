-- Best-effort structural rollback (schema only, no data — the up migration
-- is a genuine, intentional data-discarding rewrite per product decision,
-- not a mistake to silently undo).
ALTER TYPE notification_type RENAME VALUE 'protocol_review' TO 'report_review';

CREATE TYPE report_status AS ENUM ('pending_committee', 'approved', 'rejected');
CREATE TYPE report_vote_decision AS ENUM ('approved', 'rejected');

CREATE TABLE report_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    file_url        TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    intro_text      TEXT NOT NULL DEFAULT '',
    student_columns TEXT[] NOT NULL DEFAULT '{full_name}'
);

CREATE TABLE reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES report_templates(id),
    created_by          UUID NOT NULL REFERENCES users(id),
    status              report_status NOT NULL DEFAULT 'pending_committee',
    previous_report_id  UUID REFERENCES reports(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_previous_report_id ON reports(previous_report_id);

CREATE TABLE report_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    application_id  UUID NOT NULL REFERENCES applications(id),
    UNIQUE (report_id, application_id)
);

CREATE INDEX idx_report_applications_report_id ON report_applications(report_id);
CREATE INDEX idx_report_applications_application_id ON report_applications(application_id);

CREATE TABLE committee_votes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id             UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    committee_member_id   UUID NOT NULL REFERENCES users(id),
    decision              report_vote_decision,
    reason                TEXT,
    voted_at              TIMESTAMPTZ,
    UNIQUE (report_id, committee_member_id),
    CONSTRAINT chk_committee_votes_reason_required CHECK (
        decision IS DISTINCT FROM 'rejected' OR reason IS NOT NULL
    )
);

CREATE INDEX idx_committee_votes_report_id ON committee_votes(report_id);

ALTER TABLE dormitories ADD COLUMN default_report_template_id UUID NULL REFERENCES report_templates(id) ON DELETE SET NULL;
