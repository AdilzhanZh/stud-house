CREATE TYPE exit_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE exit_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_resident_id  UUID NOT NULL REFERENCES room_residents(id),
    student_id        UUID NOT NULL REFERENCES users(id),
    reason            TEXT,
    status            exit_request_status NOT NULL DEFAULT 'pending',
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by        UUID REFERENCES users(id),
    decided_at        TIMESTAMPTZ,
    comment           TEXT
);

CREATE INDEX idx_exit_requests_status ON exit_requests(status);
CREATE INDEX idx_exit_requests_student_id ON exit_requests(student_id);

-- one open exit request per room stay at a time
CREATE UNIQUE INDEX uniq_exit_requests_active_resident ON exit_requests(room_resident_id) WHERE status = 'pending';
