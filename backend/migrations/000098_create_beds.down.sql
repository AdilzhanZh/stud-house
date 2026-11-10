DROP INDEX IF EXISTS uniq_room_residents_active_bed;
DROP INDEX IF EXISTS idx_room_residents_bed_id;
ALTER TABLE room_residents DROP COLUMN IF EXISTS bed_id;
DROP TABLE IF EXISTS beds;
