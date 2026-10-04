ALTER TABLE users DROP CONSTRAINT chk_positions_require_user_role;
ALTER TABLE users DROP CONSTRAINT chk_chairperson_requires_committee;

-- Users without the manager position have no equivalent in the old schema;
-- they fall back to manager, the only non-admin staff role it had.
ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('admin', 'student', 'manager');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING (
    CASE role::text WHEN 'user' THEN 'manager' ELSE role::text END
)::user_role;
DROP TYPE user_role_old;

ALTER TABLE users ADD CONSTRAINT chk_chairperson_requires_committee CHECK (
    is_chairperson = false OR (role = 'manager' AND is_committee_member = true)
);

ALTER TABLE users DROP COLUMN is_manager;
