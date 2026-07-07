CREATE TYPE report_status AS ENUM ('pending_committee', 'approved', 'rejected');

-- previous_report_id chains a resubmitted report (after a rejection) back to
-- the one it revises; the old report itself is never mutated once decided.
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
