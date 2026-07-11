-- Data cleanup: earlier bug allowed more than one committee member to be
-- marked chairperson at once. Keep only the most recently assigned one.
UPDATE users SET is_chairperson = false
WHERE is_chairperson = true
AND id NOT IN (
    SELECT id FROM users WHERE is_chairperson = true ORDER BY updated_at DESC LIMIT 1
);

-- A partial unique index on a column that's constant (true) within the
-- filtered set allows at most one matching row — the standard Postgres
-- pattern for "at most one row where X" invariants.
CREATE UNIQUE INDEX idx_users_single_chairperson ON users ((is_chairperson)) WHERE is_chairperson = true;
