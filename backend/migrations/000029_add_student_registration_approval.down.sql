DROP INDEX IF EXISTS uniq_users_iin;

ALTER TABLE users
    DROP COLUMN IF EXISTS approval_status,
    DROP COLUMN IF EXISTS iin;

DROP TYPE IF EXISTS user_approval_status;
