-- The admin "create room" form now collects a single seat count
-- (rooms.capacity) instead of a top/bottom bunk split, and no longer
-- collects area/equipment.
ALTER TABLE rooms
    DROP COLUMN top_beds,
    DROP COLUMN bottom_beds,
    DROP COLUMN area_sq_m,
    DROP COLUMN equipment;
