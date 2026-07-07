CREATE TYPE transfer_request_status AS ENUM ('pending', 'approved', 'rejected');

-- A settled student's request to move to a different room/dormitory.
-- requested_dormitory_id/requested_room_id are just the student's
-- non-binding hints — the manager always supplies an explicit room_id
-- when approving (see TransferRequestService.Decide).
CREATE TABLE transfer_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id              UUID NOT NULL REFERENCES users(id),
    current_room_id         UUID NOT NULL REFERENCES rooms(id),
    requested_dormitory_id  UUID REFERENCES dormitories(id),
    requested_room_id       UUID REFERENCES rooms(id),
    reason                  TEXT,
    status                  transfer_request_status NOT NULL DEFAULT 'pending',
    decided_by              UUID REFERENCES users(id),
    decided_at              TIMESTAMPTZ,
    comment                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX idx_transfer_requests_student_id ON transfer_requests(student_id);

-- one open transfer request per student at a time
CREATE UNIQUE INDEX uniq_transfer_requests_active_student ON transfer_requests(student_id) WHERE status = 'pending';
