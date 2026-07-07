CREATE TYPE contract_status AS ENUM ('sent', 'accepted', 'declined', 'expired');

-- file_url is populated from the report's template at auto-creation time
-- (no per-student document generation this phase); one contract per
-- application (UNIQUE), auto-created when the application's report becomes
-- approved (see ReportService's onApproved hook in phase 3's file).
CREATE TABLE contracts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id     UUID NOT NULL UNIQUE REFERENCES applications(id),
    file_url           TEXT NOT NULL,
    status             contract_status NOT NULL DEFAULT 'sent',
    sent_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at       TIMESTAMPTZ,
    response_deadline  TIMESTAMPTZ NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_response_deadline ON contracts(response_deadline);
