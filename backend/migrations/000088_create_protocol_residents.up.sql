-- Current dormitory residents can now go into a protocol even when they have
-- no approved application to attach through protocol_applications (students
-- placed in a room directly, for instance). UNIQUE (student_id) is what makes
-- "not already in a protocol" hold under concurrent requests; deleting a
-- pending protocol cascades here and frees its residents for a new one.
-- dormitory_name and room_number are snapshots so that a signed protocol keeps
-- naming the same place after the student moves out or the room is deleted.
CREATE TABLE protocol_residents (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id    UUID NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
    student_id     UUID NOT NULL REFERENCES users(id),
    dormitory_name TEXT NOT NULL,
    room_number    TEXT NOT NULL,
    UNIQUE (student_id)
);

CREATE INDEX idx_protocol_residents_protocol_id ON protocol_residents(protocol_id);
