-- Bed place statuses. Every bed place is shown as one of: free (свободно),
-- reserved (забронировано), occupied (занято), repair (на ремонте) or
-- unavailable (временно недоступно).
--
-- Only repair/unavailable are stored, in beds.service_status, because a
-- manager sets them by hand. The other three are always worked out, so they
-- can never drift out of sync:
--   occupied — the bed has a current stay (room_residents.moved_out_at NULL);
--   reserved — an active application holds this exact bed (held_bed_id);
--   free     — none of the above.
-- A bed that someone lives on or holds cannot be taken out of service, and
-- an out-of-service bed cannot get a stay or a hold, so the statuses never
-- overlap.
ALTER TABLE beds
    ADD COLUMN service_status     VARCHAR(20) NOT NULL DEFAULT 'in_service'
        CHECK (service_status IN ('in_service', 'repair', 'unavailable')),
    ADD COLUMN service_reason     TEXT,
    -- Expected date the bed is back in service; informational only, the
    -- bed returns to service only when a manager says so.
    ADD COLUMN service_until      DATE,
    ADD COLUMN service_changed_at TIMESTAMPTZ,
    ADD COLUMN service_changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT beds_in_service_has_no_reason
        CHECK (service_status <> 'in_service' OR (service_reason IS NULL AND service_until IS NULL));

-- Every change of a bed's service status, newest kept forever.
CREATE TABLE bed_status_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bed_id      UUID NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    old_status  VARCHAR(20) NOT NULL,
    new_status  VARCHAR(20) NOT NULL,
    reason      TEXT,
    until       DATE,
    changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bed_status_history_bed ON bed_status_history(bed_id, changed_at DESC);

-- The bed an active application holds. A hold used to be counted per room
-- only (COALESCE(assigned_room_id, preferred_room_id)); it now also names a
-- bed of that room, so the bed shows as reserved. The trigger below keeps it
-- in sync on every write, so application code does not have to set it.
ALTER TABLE applications ADD COLUMN held_bed_id UUID REFERENCES beds(id) ON DELETE SET NULL;
-- One active hold per bed: the database itself blocks double reservation.
CREATE UNIQUE INDEX uniq_applications_active_held_bed ON applications(held_bed_id)
    WHERE status IN ('pending', 'manager_review', 'approved');

-- applications_sync_held_bed: an application that is active and claims a
-- room holds one bed of it; any other application holds none. A held bed is
-- kept while it stays usable (same room, not retired, in service, nobody
-- else living on it); otherwise the room's first free bed is taken, the
-- same order RoomRepo uses (numeric labels first). The room row is locked
-- first, like every other bed change, so two holds can't grab one bed. If
-- the room has no free bed left the application keeps its room-level hold
-- with held_bed_id NULL (RoomService.CheckHoldable stops that up front).
CREATE FUNCTION applications_sync_held_bed() RETURNS trigger AS $$
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

CREATE TRIGGER applications_sync_held_bed
    BEFORE INSERT OR UPDATE OF status, assigned_room_id, preferred_room_id, held_bed_id
    ON applications
    FOR EACH ROW EXECUTE FUNCTION applications_sync_held_bed();

-- Backstops for the rules RoomRepo checks under the room lock.
-- A stay can only go on a bed that is in service.
CREATE FUNCTION room_residents_bed_in_service() RETURNS trigger AS $$
BEGIN
    IF NEW.bed_id IS NOT NULL AND NEW.moved_out_at IS NULL AND EXISTS (
        SELECT 1 FROM beds WHERE id = NEW.bed_id AND service_status <> 'in_service'
    ) THEN
        RAISE EXCEPTION 'bed % is out of service', NEW.bed_id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_residents_bed_in_service
    BEFORE INSERT OR UPDATE OF bed_id ON room_residents
    FOR EACH ROW EXECUTE FUNCTION room_residents_bed_in_service();

-- A bed someone lives on or holds can't be taken out of service.
CREATE FUNCTION beds_check_service_change() RETURNS trigger AS $$
BEGIN
    IF NEW.service_status <> 'in_service' AND OLD.service_status = 'in_service' AND (
        EXISTS (SELECT 1 FROM room_residents
                WHERE bed_id = NEW.id AND moved_out_at IS NULL)
        OR EXISTS (SELECT 1 FROM applications
                   WHERE held_bed_id = NEW.id
                     AND status IN ('pending', 'manager_review', 'approved'))
    ) THEN
        RAISE EXCEPTION 'bed % is occupied or reserved', NEW.id USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beds_check_service_change
    BEFORE UPDATE OF service_status ON beds
    FOR EACH ROW EXECUTE FUNCTION beds_check_service_change();

-- Backfill: give every active hold a bed, oldest application first, by
-- re-saving it so the trigger above picks the bed.
DO $$
DECLARE
    app_id UUID;
BEGIN
    FOR app_id IN
        SELECT id FROM applications
        WHERE status IN ('pending', 'manager_review', 'approved')
          AND COALESCE(assigned_room_id, preferred_room_id) IS NOT NULL
        ORDER BY created_at, id
    LOOP
        UPDATE applications SET held_bed_id = NULL WHERE id = app_id;
    END LOOP;
END $$;

-- Seat statistics: out-of-service beds are no longer counted as free.
-- Columns are kept as they were (out_of_service_beds is appended) so
-- CREATE OR REPLACE keeps the stats_reader grant.
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
