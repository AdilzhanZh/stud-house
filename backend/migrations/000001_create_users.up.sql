CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'student', 'manager', 'committee_member');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(32) NOT NULL DEFAULT '',
    password_hash   TEXT NOT NULL,
    role            user_role NOT NULL,
    is_chairperson  BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- chairperson is an additional flag on top of the committee_member role, not a separate role
    CONSTRAINT chk_chairperson_requires_committee CHECK (
        is_chairperson = false OR role = 'committee_member'
    )
);

CREATE INDEX idx_users_role ON users(role);
