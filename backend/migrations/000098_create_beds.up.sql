-- Every bed place (койко-место) in a room becomes its own record with a
-- permanent identity: `id` for the system and `inventory_no` for people
-- (shown as B-000412). A bed place is never deleted or renumbered. When a
-- dormitory physically removes a bed, the place is retired (retired_at set)
-- so its id and stay history survive. When a bed is added, a new place with
-- a new id is created; retired ids are never reused. Relocating a student
-- only changes which bed their stay points to, never the bed itself.
--
-- rooms.capacity stays and always equals the room's active (non-retired)
-- bed count — RoomRepo keeps the two in sync in one transaction — so the
-- existing seat counting, holds and stats views keep working unchanged.
CREATE TABLE beds (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_no  BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    room_id       UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    -- Position inside the room ("1", "2", "у окна"...). Editable; only the
    -- id/inventory_no are permanent.
    label         VARCHAR(50) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    retired_at    TIMESTAMPTZ
);

CREATE INDEX idx_beds_room_id ON beds(room_id);
-- Labels only need to be unique among a room's current beds: a retired
-- bed's label can be taken by a new bed place (which still gets a new id).
CREATE UNIQUE INDEX uniq_beds_active_label ON beds(room_id, label) WHERE retired_at IS NULL;

-- Stays recorded before this migration that already ended keep bed_id NULL:
-- nobody recorded which bed they used.
ALTER TABLE room_residents ADD COLUMN bed_id UUID REFERENCES beds(id) ON DELETE SET NULL;
CREATE INDEX idx_room_residents_bed_id ON room_residents(bed_id);
-- At most one current stay per bed: the database itself blocks double booking.
CREATE UNIQUE INDEX uniq_room_residents_active_bed ON room_residents(bed_id) WHERE moved_out_at IS NULL;

-- Backfill: one bed place per seat of every existing room (labels 1..N),
-- or one per current resident if a room somehow holds more residents than
-- its capacity, so every current stay below gets a bed.
INSERT INTO beds (room_id, label)
SELECT r.id, gs::text
FROM rooms r
CROSS JOIN LATERAL generate_series(
    1,
    GREATEST(r.capacity,
             (SELECT count(*) FROM room_residents rr
              WHERE rr.room_id = r.id AND rr.moved_out_at IS NULL)::int)
) AS gs;

UPDATE rooms r
SET capacity = (SELECT count(*) FROM beds b WHERE b.room_id = r.id AND b.retired_at IS NULL)
WHERE capacity <> (SELECT count(*) FROM beds b WHERE b.room_id = r.id AND b.retired_at IS NULL);

-- Seat each current resident on a bed of their room, in move-in order.
WITH numbered_residents AS (
    SELECT rr.id, rr.room_id,
           row_number() OVER (PARTITION BY rr.room_id ORDER BY rr.moved_in_at, rr.id) AS n
    FROM room_residents rr
    WHERE rr.moved_out_at IS NULL
),
numbered_beds AS (
    SELECT b.id, b.room_id,
           row_number() OVER (PARTITION BY b.room_id ORDER BY b.label::int) AS n
    FROM beds b
)
UPDATE room_residents rr
SET bed_id = nb.id
FROM numbered_residents nr
JOIN numbered_beds nb ON nb.room_id = nr.room_id AND nb.n = nr.n
WHERE rr.id = nr.id;
