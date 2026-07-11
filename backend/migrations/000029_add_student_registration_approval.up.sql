-- Students must be approved by a manager/admin before they can log in;
-- self-registration alone no longer grants access. IIN (ЖСН) is required
-- for students and must be unique. Non-student roles (created directly by
-- admin via UserService.CreateUser) get approval_status='approved' and no
-- IIN, so this doesn't affect them.
CREATE TYPE user_approval_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE users
    ADD COLUMN iin VARCHAR(12),
    ADD COLUMN approval_status user_approval_status NOT NULL DEFAULT 'approved';

-- Partial unique index: only enforce uniqueness where an IIN is actually set
-- (non-student roles have no IIN, and a plain UNIQUE column would otherwise
-- reject a second NULL under some constraint styles — this is explicit).
CREATE UNIQUE INDEX uniq_users_iin ON users(iin) WHERE iin IS NOT NULL;
