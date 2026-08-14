ALTER TABLE rooms
    ADD COLUMN top_beds    INT NOT NULL DEFAULT 0,
    ADD COLUMN bottom_beds INT NOT NULL DEFAULT 0,
    ADD COLUMN area_sq_m   NUMERIC(6, 2),
    ADD COLUMN equipment   TEXT;
