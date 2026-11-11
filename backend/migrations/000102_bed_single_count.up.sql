-- One bed place, one count.
--
-- 1. A student who lives in a dormitory holds no bed: their application,
--    if any, can't reserve a second place (a move goes through a transfer
--    request). The hold is released the moment they move in.
-- 2. Seat statistics count beds by their status — each active bed exactly
--    once — instead of counting reservations per room next to the beds.
-- 3. bed_consistency_issues lists anything that would mean a bed is counted
--    twice or its status log is out of date. It is expected to be empty.

-- (1) The held-bed trigger from migration 000100, plus: no hold while the
-- student has an active stay.
CREATE OR REPLACE FUNCTION applications_sync_held_bed() RETURNS trigger AS $$
DECLARE
    v_room UUID := COALESCE(NEW.assigned_room_id, NEW.preferred_room_id);
BEGIN
    IF NEW.status NOT IN ('pending', 'manager_review', 'approved') OR v_room IS NULL
       OR EXISTS (SELECT 1 FROM room_residents
                  WHERE student_id = NEW.student_id AND moved_out_at IS NULL) THEN
        NEW.held_bed_id := NULL;
        RETURN NEW;
    END IF;

    PERFORM 1 FROM rooms WHERE id = v_room FOR UPDATE;

    IF NEW.held_bed_id IS NOT NULL THEN
        PERFORM 1 FROM beds b
        WHERE b.id = NEW.held_bed_id AND b.room_id = v_room
          AND b.retired_at IS NULL AND b.service_status = 'in_service'
          AND NOT EXISTS (SELECT 1 FROM room_residents rr
                          WHERE rr.bed_id = b.id AND rr.moved_out_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM applications a
                          WHERE a.held_bed_id = b.id AND a.id <> NEW.id
                            AND a.status IN ('pending', 'manager_review', 'approved'));
        IF FOUND THEN
            RETURN NEW;
        END IF;
    END IF;

    SELECT b.id INTO NEW.held_bed_id
    FROM beds b
    WHERE b.room_id = v_room AND b.retired_at IS NULL AND b.service_status = 'in_service'
      AND NOT EXISTS (SELECT 1 FROM room_residents rr
                      WHERE rr.bed_id = b.id AND rr.moved_out_at IS NULL)
      AND NOT EXISTS (SELECT 1 FROM applications a
                      WHERE a.held_bed_id = b.id AND a.id <> NEW.id
                        AND a.status IN ('pending', 'manager_review', 'approved'))
    ORDER BY (b.label ~ '^[0-9]{1,9}$') DESC,
             CASE WHEN b.label ~ '^[0-9]{1,9}$' THEN b.label::int END ASC,
             b.label ASC, b.inventory_no ASC
    LIMIT 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Moving in releases the student's hold. Runs after the status log trigger
-- (triggers fire in name order), so the bed is logged as reserved →
-- occupied first and releasing the hold on it then changes nothing.
CREATE FUNCTION room_residents_release_holds() RETURNS trigger AS $$
BEGIN
    IF NEW.moved_out_at IS NULL THEN
        UPDATE applications SET held_bed_id = NULL
        WHERE student_id = NEW.student_id AND held_bed_id IS NOT NULL
          AND status IN ('pending', 'manager_review', 'approved');
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_residents_release_holds
    AFTER INSERT ON room_residents
    FOR EACH ROW EXECUTE FUNCTION room_residents_release_holds();

-- Existing residents with a hold give it up now.
UPDATE applications a SET held_bed_id = NULL
WHERE a.held_bed_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM room_residents rr
              WHERE rr.student_id = a.student_id AND rr.moved_out_at IS NULL);

-- (2) Seat statistics from bed statuses. Same columns as before.
CREATE OR REPLACE VIEW stats_dormitory_seats AS
WITH bed_load AS (
    SELECT r.dormitory_id, bed_current_status(b.id) AS status
    FROM beds b
    JOIN rooms r ON r.id = b.room_id
    WHERE b.retired_at IS NULL
)
SELECT
    d.id AS dormitory_id,
    d.name AS dormitory_name,
    d.total_capacity,
    count(bl.status)::int AS room_beds,
    count(*) FILTER (WHERE bl.status = 'occupied')::int AS residents,
    count(*) FILTER (WHERE bl.status = 'reserved')::int AS held,
    count(*) FILTER (WHERE bl.status = 'free')::int AS free_beds,
    count(*) FILTER (WHERE bl.status IN ('repair', 'unavailable'))::int AS out_of_service_beds
FROM dormitories d
LEFT JOIN bed_load bl ON bl.dormitory_id = d.id
GROUP BY d.id, d.name, d.total_capacity;

-- (3) Anything that would count a bed twice or leave its log stale:
--   log_mismatch      the last logged status isn't the bed's status;
--   held_by_resident  a student who lives somewhere also holds this bed;
--   retired_in_use    a removed bed still has a stay or a hold;
--   hold_without_bed  an active application claims a room but no bed (the
--                     room was full), so its seat is counted nowhere.
-- Two stays or two holds on one bed, or two stays of one student, are
-- impossible already (unique indexes).
CREATE VIEW bed_consistency_issues AS
SELECT b.id AS bed_id, b.room_id, 'log_mismatch'::text AS issue
FROM beds b
WHERE b.retired_at IS NULL
  AND bed_current_status(b.id) IS DISTINCT FROM COALESCE(
      (SELECT h.new_status FROM bed_status_history h
       WHERE h.bed_id = b.id ORDER BY h.seq DESC LIMIT 1), 'free')
UNION ALL
SELECT a.held_bed_id, b.room_id, 'held_by_resident'
FROM applications a
JOIN beds b ON b.id = a.held_bed_id
WHERE a.status IN ('pending', 'manager_review', 'approved')
  AND EXISTS (SELECT 1 FROM room_residents rr
              WHERE rr.student_id = a.student_id AND rr.moved_out_at IS NULL)
UNION ALL
SELECT b.id, b.room_id, 'retired_in_use'
FROM beds b
WHERE b.retired_at IS NOT NULL
  AND (EXISTS (SELECT 1 FROM room_residents rr WHERE rr.bed_id = b.id AND rr.moved_out_at IS NULL)
       OR EXISTS (SELECT 1 FROM applications a WHERE a.held_bed_id = b.id
                  AND a.status IN ('pending', 'manager_review', 'approved')))
UNION ALL
SELECT NULL::uuid, COALESCE(a.assigned_room_id, a.preferred_room_id), 'hold_without_bed'
FROM applications a
WHERE a.status IN ('pending', 'manager_review', 'approved')
  AND a.held_bed_id IS NULL
  AND COALESCE(a.assigned_room_id, a.preferred_room_id) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM room_residents rr
                  WHERE rr.student_id = a.student_id AND rr.moved_out_at IS NULL);
