-- See internal/domain/protocol.go: a protocol only ever rests at 'pending'
-- or 'approved' — no 'rejected' aggregate state. A member's individual
-- rejection is recorded on committee_votes but doesn't move the protocol
-- itself; it just stays 'pending' until the manager deletes/redoes it.
CREATE TYPE protocol_status AS ENUM ('pending', 'approved');

CREATE TABLE protocols (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Sequential, never reused, matches the paper template's "№___" blank.
    number      SERIAL,
    status      protocol_status NOT NULL DEFAULT 'pending',
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_protocols_status ON protocols(status);

-- Which approved applications a protocol bundles. An application can only
-- ever belong to one protocol (any status) at a time — enforced at the
-- service/repository layer (see ProtocolService.Create /
-- lockAndValidateApprovedApplications), since a partial unique index can't
-- express "not already in ANY protocol regardless of that protocol's status".
CREATE TABLE protocol_applications (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id    UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id),
    UNIQUE (protocol_id, application_id)
);

CREATE INDEX idx_protocol_applications_protocol_id ON protocol_applications(protocol_id);
CREATE INDEX idx_protocol_applications_application_id ON protocol_applications(application_id);

CREATE TYPE protocol_vote_decision AS ENUM ('approved', 'rejected');

-- One row per committee_member per protocol, created up front with decision
-- NULL when the protocol is prepared; committee_member_id's role is
-- validated at the service layer (a CHECK here can't read another table's
-- column). reason is required once rejected.
CREATE TABLE committee_votes (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id           UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    committee_member_id   UUID NOT NULL REFERENCES users(id),
    decision              protocol_vote_decision,
    reason                TEXT,
    voted_at              TIMESTAMPTZ,
    UNIQUE (protocol_id, committee_member_id),
    CONSTRAINT chk_committee_votes_reason_required CHECK (
        decision IS DISTINCT FROM 'rejected' OR reason IS NOT NULL
    )
);

CREATE INDEX idx_committee_votes_protocol_id ON committee_votes(protocol_id);

-- Singleton table (mirrors petition_template, migration 000061): one
-- manager/admin-editable protocol document, its id pinned by the CHECK
-- constraint. A different fixed id than petition_template's so the two
-- singletons can never collide.
CREATE TABLE protocol_template (
    id           UUID PRIMARY KEY,
    content_html TEXT NOT NULL,
    updated_by   UUID NOT NULL REFERENCES users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT protocol_template_singleton CHECK (id = '00000000-0000-0000-0000-000000000002')
);
