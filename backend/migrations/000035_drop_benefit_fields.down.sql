CREATE TABLE benefit_fields (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benefit_id  UUID NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
    field_name  VARCHAR(255) NOT NULL,
    field_type  VARCHAR(50) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_benefit_fields_benefit_id ON benefit_fields(benefit_id);
