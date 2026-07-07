CREATE TYPE gender_type AS ENUM ('male', 'female');

-- Room restriction validation (gender/course) reads from this table.
-- Only meaningful for users with role = 'student'; enforced in the application layer
-- since a CHECK constraint cannot reference another table's column.
CREATE TABLE student_profiles (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    gender      gender_type,
    course      SMALLINT CHECK (course BETWEEN 1 AND 6),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
