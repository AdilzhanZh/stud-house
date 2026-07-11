-- Additive columns for the admin "create room" form fields missing since
-- phase 1: floor, category/type, area, equipment description. `category` is
-- a free-form string (not a Postgres enum) since the spec only fixes one
-- example value ("general") and doesn't enumerate the full vocabulary.
ALTER TABLE rooms
    ADD COLUMN floor      INT,
    ADD COLUMN category   VARCHAR(50) NOT NULL DEFAULT 'general',
    ADD COLUMN area_sq_m  NUMERIC(6, 2),
    ADD COLUMN equipment  TEXT;
