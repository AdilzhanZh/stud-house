-- Optional descriptive fields for a room (the dormitory checklist asks for
-- each room's area, equipment, sanitary conditions, accessibility for
-- persons with disabilities and photos). None are required: NULL / empty
-- means "not filled in yet".
ALTER TABLE rooms
    ADD COLUMN area_sq_m           NUMERIC(6, 2),
    ADD COLUMN equipment           TEXT,
    ADD COLUMN sanitary_conditions TEXT,
    ADD COLUMN is_accessible       BOOLEAN,
    ADD COLUMN accessibility_notes TEXT,
    ADD COLUMN photo_urls          TEXT[] NOT NULL DEFAULT '{}';
