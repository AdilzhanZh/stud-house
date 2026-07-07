CREATE TYPE report_vote_decision AS ENUM ('approved', 'rejected');

-- One row per committee_member per report, created up front with decision
-- NULL when the report is sent to committee; committee_member_id's role is
-- validated at the service layer when these rows are created (a CHECK here
-- can't read another table's column). reason is required once rejected.
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
