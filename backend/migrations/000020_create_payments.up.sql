CREATE TYPE payment_status AS ENUM ('pending', 'submitted', 'confirmed', 'rejected');

CREATE TABLE payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id       UUID NOT NULL UNIQUE REFERENCES contracts(id),
    amount            NUMERIC(12, 2) NOT NULL,
    currency          VARCHAR(3) NOT NULL DEFAULT 'KZT',
    receipt_file_url  TEXT,
    status            payment_status NOT NULL DEFAULT 'pending',
    submitted_at      TIMESTAMPTZ,
    confirmed_by      UUID REFERENCES users(id),
    confirmed_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_status ON payments(status);
