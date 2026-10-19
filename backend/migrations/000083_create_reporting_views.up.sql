-- Aggregate-only views for natural-language statistics questions and
-- ministry reports, plus stats_reader: the only role those queries run as.
-- stats_reader can read the stats_* views and nothing else (views run with
-- their owner's privileges, so it needs no access to the underlying
-- tables). The backend logs in as it over a separate connection pool, with
-- a random password it sets at startup, so a generated query can never
-- touch per-student rows or write anything.

-- Applicants by every dimension a report usually needs. "stage" is the
-- same pipeline mapping as stats_application_stages.
CREATE VIEW stats_applications AS
SELECT
    d.name AS dormitory_name,
    CASE
        WHEN a.status IN ('pending', 'manager_review') THEN 'awaiting_review'
        WHEN a.status = 'needs_correction' THEN 'awaiting_documents'
        WHEN a.status = 'settled' OR c.status = 'accepted' THEN 'settled'
        WHEN a.status = 'approved' AND c.id IS NULL THEN 'awaiting_commission'
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

-- Applicants per benefit they hold (an applicant with two benefits counts
-- once under each).
CREATE VIEW stats_application_benefits AS
SELECT
    d.name AS dormitory_name,
    b.name_kk AS benefit_name_kk,
    b.name_ru AS benefit_name_ru,
    (a.created_at AT TIME ZONE 'Asia/Qyzylorda')::date AS submitted_on,
    a.status::text AS application_status,
    count(*)::int AS applications
FROM applications a
JOIN dormitories d ON d.id = a.dormitory_id
JOIN student_benefits sb ON sb.student_id = a.student_id
JOIN benefits b ON b.id = sb.benefit_id
GROUP BY 1, 2, 3, 4, 5;

-- Current residents.
CREATE VIEW stats_residents AS
SELECT
    d.name AS dormitory_name,
    r.floor,
    sp.gender::text AS gender,
    sp.course,
    sp.academic_degree::text AS academic_degree,
    EXISTS (SELECT 1 FROM student_benefits sb WHERE sb.student_id = rr.student_id) AS has_benefit,
    count(*)::int AS residents
FROM room_residents rr
JOIN rooms r ON r.id = rr.room_id
JOIN dormitories d ON d.id = r.dormitory_id
LEFT JOIN student_profiles sp ON sp.user_id = rr.student_id
WHERE rr.moved_out_at IS NULL
GROUP BY 1, 2, 3, 4, 5, 6;

CREATE VIEW stats_contracts AS
SELECT
    d.name AS dormitory_name,
    c.status::text AS status,
    (c.status = 'awaiting_manager_decision' OR (c.status = 'sent' AND c.response_deadline < now())) AS overdue,
    (c.sent_at AT TIME ZONE 'Asia/Qyzylorda')::date AS sent_on,
    count(*)::int AS contracts
FROM contracts c
JOIN applications a ON a.id = c.application_id
JOIN dormitories d ON d.id = a.dormitory_id
GROUP BY 1, 2, 3, 4;

CREATE VIEW stats_resident_requests AS
SELECT 'move_out' AS kind, e.status::text AS status,
       (e.requested_at AT TIME ZONE 'Asia/Qyzylorda')::date AS created_on, count(*)::int AS requests
FROM exit_requests e GROUP BY 1, 2, 3
UNION ALL
SELECT 'room_transfer', t.status::text, (t.created_at AT TIME ZONE 'Asia/Qyzylorda')::date, count(*)::int
FROM transfer_requests t GROUP BY 1, 2, 3;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'stats_reader') THEN
        CREATE ROLE stats_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END
$$;
ALTER ROLE stats_reader SET default_transaction_read_only = on;
ALTER ROLE stats_reader SET statement_timeout = '5s';
GRANT SELECT ON stats_application_stages, stats_dormitory_seats, stats_applications,
    stats_application_benefits, stats_residents, stats_contracts, stats_resident_requests
    TO stats_reader;
