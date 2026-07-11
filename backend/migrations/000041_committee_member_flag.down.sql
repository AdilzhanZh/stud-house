ALTER TABLE users DROP CONSTRAINT chk_chairperson_requires_committee;

ALTER TYPE user_role RENAME TO user_role_new;
CREATE TYPE user_role AS ENUM ('admin', 'student', 'manager', 'committee_member');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_new;

UPDATE users SET role = 'committee_member' WHERE is_committee_member = true;

ALTER TABLE users DROP COLUMN is_committee_member;

ALTER TABLE users ADD CONSTRAINT chk_chairperson_requires_committee CHECK (
    is_chairperson = false OR role = 'committee_member'
);
