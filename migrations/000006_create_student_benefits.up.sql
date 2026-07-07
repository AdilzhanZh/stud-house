-- Minimal assignment record ("student X has benefit Y"), used by room restriction
-- validation. The full application/approval workflow is out of scope for this phase.
CREATE TABLE student_benefits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID NOT NULL REFERENCES users(id),
    benefit_id   UUID NOT NULL REFERENCES benefits(id),
    assigned_by  UUID NOT NULL REFERENCES users(id),
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, benefit_id)
);

CREATE INDEX idx_student_benefits_student_id ON student_benefits(student_id);
CREATE INDEX idx_student_benefits_benefit_id ON student_benefits(benefit_id);
