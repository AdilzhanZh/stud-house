-- Aggregate-only views behind the campaign-progress dashboard. They expose
-- counts, never per-student rows, so the same views can later be the only
-- thing a read-only reporting role (e.g. natural-language queries) is
-- granted SELECT on.

-- Where each application currently sits in the intake pipeline, counted
-- per dormitory and per submission day (Kyzylorda local date).
CREATE VIEW stats_application_stages AS
SELECT
    a.dormitory_id,
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
    count(*)::int AS applications
FROM applications a
JOIN dormitories d ON d.id = a.dormitory_id
LEFT JOIN contracts c ON c.application_id = a.id
GROUP BY 1, 2, 3, 4;

-- Seats per dormitory. A seat is held by a not-yet-settled application
-- that picked or was assigned the room (same rule as RoomRepo.
-- CountHeldSeats); free seats are counted per room, so an over-held room
-- can't hide free seats elsewhere in the building.
CREATE VIEW stats_dormitory_seats AS
WITH room_load AS (
    SELECT
        r.dormitory_id,
        r.capacity,
        (SELECT count(*) FROM room_residents rr WHERE rr.room_id = r.id AND rr.moved_out_at IS NULL)::int AS residents,
        (SELECT count(*) FROM applications a
            WHERE COALESCE(a.assigned_room_id, a.preferred_room_id) = r.id
              AND a.status IN ('pending', 'manager_review', 'approved'))::int AS held
    FROM rooms r
)
SELECT
    d.id AS dormitory_id,
    d.name AS dormitory_name,
    d.total_capacity,
    COALESCE(sum(rl.capacity), 0)::int AS room_beds,
    COALESCE(sum(rl.residents), 0)::int AS residents,
    COALESCE(sum(rl.held), 0)::int AS held,
    COALESCE(sum(GREATEST(rl.capacity - rl.residents - rl.held, 0)), 0)::int AS free_beds
FROM dormitories d
LEFT JOIN room_load rl ON rl.dormitory_id = d.id
GROUP BY d.id, d.name, d.total_capacity;
