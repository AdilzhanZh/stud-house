CREATE TABLE rooms (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dormitory_id  UUID NOT NULL REFERENCES dormitories(id) ON DELETE CASCADE,
    room_number   VARCHAR(50) NOT NULL,
    capacity      INT NOT NULL CHECK (capacity > 0),
    restrictions  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dormitory_id, room_number)
);

CREATE INDEX idx_rooms_dormitory_id ON rooms(dormitory_id);

CREATE TABLE room_residents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    student_id    UUID NOT NULL REFERENCES users(id),
    moved_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    moved_out_at  TIMESTAMPTZ
);

CREATE INDEX idx_room_residents_room_id ON room_residents(room_id);
CREATE INDEX idx_room_residents_student_id ON room_residents(student_id);

-- a student can only have one active (not moved-out) room assignment at a time
CREATE UNIQUE INDEX uniq_room_residents_active_student ON room_residents(student_id) WHERE moved_out_at IS NULL;
