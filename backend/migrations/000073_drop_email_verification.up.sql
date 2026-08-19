-- Email confirmation is no longer required to register: the registration
-- form now just checks the email domain looks reachable (best-effort, with
-- an explicit "continue anyway" override) instead of emailing a code.
ALTER TABLE users
    DROP COLUMN email_verified_at,
    DROP COLUMN email_verification_code,
    DROP COLUMN email_verification_expires_at;
