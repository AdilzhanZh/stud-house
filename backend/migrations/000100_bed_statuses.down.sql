DROP VIEW IF EXISTS stats_dormitory_seats;
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
GRANT SELECT ON stats_dormitory_seats TO stats_reader;

DROP TRIGGER IF EXISTS beds_check_service_change ON beds;
DROP FUNCTION IF EXISTS beds_check_service_change();
DROP TRIGGER IF EXISTS room_residents_bed_in_service ON room_residents;
DROP FUNCTION IF EXISTS room_residents_bed_in_service();
DROP TRIGGER IF EXISTS applications_sync_held_bed ON applications;
DROP FUNCTION IF EXISTS applications_sync_held_bed();

DROP INDEX IF EXISTS uniq_applications_active_held_bed;
ALTER TABLE applications DROP COLUMN IF EXISTS held_bed_id;

DROP TABLE IF EXISTS bed_status_history;

ALTER TABLE beds
    DROP CONSTRAINT IF EXISTS beds_in_service_has_no_reason,
    DROP COLUMN IF EXISTS service_changed_by,
    DROP COLUMN IF EXISTS service_changed_at,
    DROP COLUMN IF EXISTS service_until,
    DROP COLUMN IF EXISTS service_reason,
    DROP COLUMN IF EXISTS service_status;
