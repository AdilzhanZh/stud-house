-- Tracks how many of a room's beds are top (үстіңгі) vs bottom (астыңғы)
-- bunk positions. Defaults to 0/0 for existing rows (collected retroactively
-- via the room edit form) — RoomService validates top+bottom == capacity
-- only on writes that actually set these fields, not via a DB CHECK, so
-- existing rows aren't broken by this migration.
ALTER TABLE rooms ADD COLUMN top_beds INT NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN bottom_beds INT NOT NULL DEFAULT 0;
