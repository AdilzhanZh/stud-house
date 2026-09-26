-- An admin/manager creating a student directly (UserService.CreateStudent)
-- no longer requires an email — students log in with their IIN (see
-- AuthService.Login), so email was never needed for them to access the
-- system. A missing email is stored as ''. The plain UNIQUE constraint on
-- email would let only one such student ever have a blank email, so swap it
-- for a partial unique index that only enforces uniqueness among non-blank
-- emails; self-registration still requires a real, unique one.
ALTER TABLE users DROP CONSTRAINT users_email_key;
CREATE UNIQUE INDEX idx_users_email_unique_nonempty ON users (email) WHERE email <> '';
