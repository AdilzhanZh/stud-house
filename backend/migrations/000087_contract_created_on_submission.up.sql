-- A contract now exists from the moment the student agrees to it while
-- applying, independent of any protocol. Give the applications already
-- submitted that way the contract they would now have.
INSERT INTO contracts (application_id, file_url, status, sent_at, responded_at, response_deadline)
SELECT id, '', 'accepted', contract_agreed_at, contract_agreed_at, contract_agreed_at
FROM applications
WHERE contract_agreed_at IS NOT NULL
ON CONFLICT (application_id) DO NOTHING;

-- An accepted contract therefore no longer means the student is settled, so
-- the stage must come from the application's own status: an approved one with
-- an agreed contract is still waiting on the commission.
CREATE OR REPLACE VIEW stats_application_stages AS
SELECT
    a.dormitory_id,
    d.name AS dormitory_name,
    CASE
        WHEN a.status IN ('pending', 'manager_review') THEN 'awaiting_review'
        WHEN a.status = 'needs_correction' THEN 'awaiting_documents'
        WHEN a.status = 'settled' THEN 'settled'
        WHEN a.status = 'approved' AND (c.id IS NULL OR c.status = 'accepted') THEN 'awaiting_commission'
        WHEN a.status = 'approved' AND c.status = 'sent' AND c.response_deadline >= now() THEN 'awaiting_confirmation'
        WHEN a.status = 'approved' THEN 'confirmation_overdue'
        WHEN c.status IN ('declined', 'expired') THEN 'contract_declined'
        ELSE 'rejected'
    END AS stage,
    (a.created_at AT TIME ZONE 'Asia/Qyzylorda')::date AS submitted_on,
    count(*)::int AS applications
FROM applications a
JOIN dormitories d ON d.id = a.dormitory_id
LEFT JOIN contracts c ON c.application_id = a.id
GROUP BY 1, 2, 3, 4;

CREATE OR REPLACE VIEW stats_applications AS
SELECT
    d.name AS dormitory_name,
    CASE
        WHEN a.status IN ('pending', 'manager_review') THEN 'awaiting_review'
        WHEN a.status = 'needs_correction' THEN 'awaiting_documents'
        WHEN a.status = 'settled' THEN 'settled'
        WHEN a.status = 'approved' AND (c.id IS NULL OR c.status = 'accepted') THEN 'awaiting_commission'
        WHEN a.status = 'approved' AND c.status = 'sent' AND c.response_deadline >= now() THEN 'awaiting_confirmation'
        WHEN a.status = 'approved' THEN 'confirmation_overdue'
        WHEN c.status IN ('declined', 'expired') THEN 'contract_declined'
        ELSE 'rejected'
    END AS stage,
    (a.created_at AT TIME ZONE 'Asia/Qyzylorda')::date AS submitted_on,
    sp.gender::text AS gender,
    sp.course,
    sp.academic_degree::text AS academic_degree,
    EXISTS (SELECT 1 FROM student_benefits sb WHERE sb.student_id = a.student_id) AS has_benefit,
    count(*)::int AS applications
FROM applications a
JOIN dormitories d ON d.id = a.dormitory_id
LEFT JOIN contracts c ON c.application_id = a.id
LEFT JOIN student_profiles sp ON sp.user_id = a.student_id
GROUP BY 1, 2, 3, 4, 5, 6, 7;
