CREATE TYPE application_status AS ENUM (
    'pending', 'manager_review', 'needs_correction', 'approved', 'rejected'
);

CREATE TABLE applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id          UUID NOT NULL REFERENCES users(id),
    dormitory_id        UUID NOT NULL REFERENCES dormitories(id),
    status              application_status NOT NULL DEFAULT 'pending',
    preferred_room_type VARCHAR(100),
    notes               TEXT,
    assigned_room_id    UUID REFERENCES rooms(id),
    handled_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_student_id ON applications(student_id);
CREATE INDEX idx_applications_status ON applications(status);

-- one active (non-terminal) application per student at a time
CREATE UNIQUE INDEX uniq_applications_active_student ON applications(student_id)
    WHERE status IN ('pending', 'manager_review', 'needs_correction');
