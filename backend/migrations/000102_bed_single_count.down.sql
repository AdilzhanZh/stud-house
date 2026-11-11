DROP VIEW IF EXISTS bed_consistency_issues;

DROP TRIGGER IF EXISTS room_residents_release_holds ON room_residents;
DROP FUNCTION IF EXISTS room_residents_release_holds();

-- The held-bed trigger as migration 000100 left it.
CREATE OR REPLACE FUNCTION applications_sync_held_bed() RETURNS trigger AS $$
DECLARE
    v_room UUID := COALESCE(NEW.assigned_room_id, NEW.preferred_room_id);
BEGIN
    IF NEW.status NOT IN ('pending', 'manager_review', 'approved') OR v_room IS NULL THEN
        NEW.held_bed_id := NULL;
        RETURN NEW;
    END IF;

    PERFORM 1 FROM rooms WHERE id = v_room FOR UPDATE;

    IF NEW.held_bed_id IS NOT NULL THEN
        PERFORM 1 FROM beds b
        WHERE b.id = NEW.held_bed_id AND b.room_id = v_room
          AND b.retired_at IS NULL AND b.service_status = 'in_service'
          AND NOT EXISTS (SELECT 1 FROM room_residents rr
                          WHERE rr.bed_id = b.id AND rr.moved_out_at IS NULL
                            AND rr.student_id <> NEW.student_id)
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

-- Seat statistics as migration 000100 left them.
CREATE OR REPLACE VIEW stats_dormitory_seats AS
WITH room_load AS (
    SELECT
        r.dormitory_id,
        r.capacity,
        (SELECT count(*) FROM room_residents rr WHERE rr.room_id = r.id AND rr.moved_out_at IS NULL)::int AS residents,
        (SELECT count(*) FROM applications a
            WHERE COALESCE(a.assigned_room_id, a.preferred_room_id) = r.id
              AND a.status IN ('pending', 'manager_review', 'approved'))::int AS held,
        (SELECT count(*) FROM beds b
            WHERE b.room_id = r.id AND b.retired_at IS NULL
              AND b.service_status <> 'in_service')::int AS out_of_service
    FROM rooms r
)
SELECT
    d.id AS dormitory_id,
    d.name AS dormitory_name,
    d.total_capacity,
    COALESCE(sum(rl.capacity), 0)::int AS room_beds,
    COALESCE(sum(rl.residents), 0)::int AS residents,
    COALESCE(sum(rl.held), 0)::int AS held,
    COALESCE(sum(GREATEST(rl.capacity - rl.out_of_service - rl.residents - rl.held, 0)), 0)::int AS free_beds,
    COALESCE(sum(rl.out_of_service), 0)::int AS out_of_service_beds
FROM dormitories d
LEFT JOIN room_load rl ON rl.dormitory_id = d.id
GROUP BY d.id, d.name, d.total_capacity;
