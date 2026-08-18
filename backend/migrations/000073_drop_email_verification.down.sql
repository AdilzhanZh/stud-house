ALTER TABLE users
    ADD COLUMN email_verified_at             TIMESTAMPTZ,
    ADD COLUMN email_verification_code       VARCHAR(6),
    ADD COLUMN email_verification_expires_at TIMESTAMPTZ;
