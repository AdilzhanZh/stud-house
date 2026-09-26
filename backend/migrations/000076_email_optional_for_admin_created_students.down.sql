DROP INDEX idx_users_email_unique_nonempty;
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
