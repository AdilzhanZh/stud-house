-- Committee membership becomes a flag admin toggles on managers ("сайлайды"),
-- not a separate role — mirrors is_chairperson, which already sits on top of
-- whatever role a user has.
ALTER TABLE users ADD COLUMN is_committee_member BOOLEAN NOT NULL DEFAULT false;

-- Must drop before this UPDATE: the old constraint requires
-- role = 'committee_member' whenever is_chairperson = true, which the
-- UPDATE below is about to change out from under the existing chairperson.
ALTER TABLE users DROP CONSTRAINT chk_chairperson_requires_committee;

UPDATE users SET role = 'manager', is_committee_member = true WHERE role = 'committee_member';

ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('admin', 'student', 'manager');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_old;

-- Defensive: guarantee the invariant holds regardless of how a row got here
-- (e.g. test data inserted directly) before the constraint validates it.
UPDATE users SET is_committee_member = true WHERE is_chairperson = true;

ALTER TABLE users ADD CONSTRAINT chk_chairperson_requires_committee CHECK (
    is_chairperson = false OR (role = 'manager' AND is_committee_member = true)
);
