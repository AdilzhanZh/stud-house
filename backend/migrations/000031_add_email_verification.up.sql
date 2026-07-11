-- Students must verify their email with a code sent at registration before
-- they can log in, independently of the existing manager-approval gate.
ALTER TABLE users
    ADD COLUMN email_verified_at             TIMESTAMPTZ,
    ADD COLUMN email_verification_code       VARCHAR(6),
    ADD COLUMN email_verification_expires_at TIMESTAMPTZ;
