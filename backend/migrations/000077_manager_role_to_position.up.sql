-- "manager" stops being a role and becomes a position admin grants on top of
-- the new plain "user" role — same pattern as is_committee_member and
-- is_chairperson. A user without the manager position only gets read-only
-- access to dormitories; granting it unlocks everything a manager had.
ALTER TABLE users ADD COLUMN is_manager BOOLEAN NOT NULL DEFAULT false;

-- Must drop before the type swap: it references role = 'manager'.
ALTER TABLE users DROP CONSTRAINT chk_chairperson_requires_committee;

ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('admin', 'student', 'user');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING (
    CASE role::text WHEN 'manager' THEN 'user' ELSE role::text END
)::user_role;
DROP TYPE user_role_old;

-- Every existing manager keeps exactly the access they had.
UPDATE users SET is_manager = true WHERE role = 'user';

ALTER TABLE users ADD CONSTRAINT chk_chairperson_requires_committee CHECK (
    is_chairperson = false OR (role = 'user' AND is_committee_member = true)
);
ALTER TABLE users ADD CONSTRAINT chk_positions_require_user_role CHECK (
    role = 'user' OR (is_manager = false AND is_committee_member = false)
);
