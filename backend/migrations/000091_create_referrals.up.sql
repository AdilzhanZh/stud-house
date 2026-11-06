-- The institute printed on a student's referral. Nullable, because accounts
-- created before this column have none until the student fills it in.
ALTER TABLE student_profiles ADD COLUMN institute TEXT;

-- A referral ("Жолдама") issued once a protocol is fully approved. Where the
-- student lives is deliberately not stored: the document always reads it from
-- room_residents, so a QR scan shows the current room, and a student who moved
-- out has no valid referral without anything having to revoke it.
--
-- protocol_number, study_group and signatory_name are snapshots: the protocol
-- and application are purged by retention while the student may still live
-- there, and a later prorector must not appear on referrals already issued.
CREATE TABLE referrals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Sequential, never reused, matches the paper form's "ЖОЛДАМА №".
    number          SERIAL,
    -- What the QR code links to, so it must not be guessable like number is.
    token           TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
    student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    protocol_id     UUID REFERENCES protocols(id) ON DELETE SET NULL,
    protocol_number INT NOT NULL,
    study_group     TEXT NOT NULL DEFAULT '',
    signatory_name  TEXT NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (protocol_id, student_id)
);

CREATE INDEX idx_referrals_student_id ON referrals(student_id);

-- Protocols approved before this feature existed: their students get a referral
-- too, in the order the protocols were approved.
INSERT INTO referrals (student_id, protocol_id, protocol_number, study_group, signatory_name, issued_at)
SELECT student_id, protocol_id, protocol_number, study_group, 'У.С. Ибраев', updated_at
FROM (
    SELECT a.student_id, p.id AS protocol_id, p.number AS protocol_number,
           COALESCE(a.study_group, '') AS study_group, p.updated_at
    FROM protocols p
    JOIN protocol_applications pa ON pa.protocol_id = p.id
    JOIN applications a ON a.id = pa.application_id
    WHERE p.status = 'approved' AND a.status IN ('approved', 'settled')
    UNION ALL
    SELECT pr.student_id, p.id, p.number,
           COALESCE((
               SELECT sg.study_group FROM applications sg
               WHERE sg.student_id = pr.student_id AND NULLIF(TRIM(sg.study_group), '') IS NOT NULL
               ORDER BY sg.created_at DESC
               LIMIT 1
           ), ''),
           p.updated_at
    FROM protocols p
    JOIN protocol_residents pr ON pr.protocol_id = p.id
    WHERE p.status = 'approved'
) issued
ORDER BY updated_at, protocol_number, student_id
ON CONFLICT (protocol_id, student_id) DO NOTHING;
