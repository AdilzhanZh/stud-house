-- A certificate of residence ("Анықтама"/"Справка с места проживания") a
-- student issues to themselves to hand in elsewhere (military registration,
-- a bank, a scholarship office).
--
-- Unlike a referral, it states facts as of the day it was issued, so every
-- detail printed on it is a snapshot: a later move or profile edit must not
-- rewrite a paper already handed in. Whether the student still lives there is
-- read live through room_resident_id, so the QR code can tell a verifier both
-- what was certified and whether it still holds.
CREATE TABLE residence_certificates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Sequential, printed on the paper as "№ 2026/0001".
    number            SERIAL,
    -- What the QR code links to, so it must not be guessable like number is.
    token             TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
    student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_resident_id  UUID REFERENCES room_residents(id) ON DELETE SET NULL,
    student_full_name TEXT NOT NULL,
    iin               TEXT NOT NULL DEFAULT '',
    institute         TEXT NOT NULL DEFAULT '',
    study_group       TEXT NOT NULL DEFAULT '',
    course            SMALLINT,
    dormitory_name    TEXT NOT NULL,
    dormitory_address TEXT NOT NULL DEFAULT '',
    room_number       TEXT NOT NULL,
    moved_in_at       TIMESTAMPTZ NOT NULL,
    signatory_name    TEXT NOT NULL,
    issued_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_residence_certificates_student_id ON residence_certificates(student_id);
