-- A dormitory's point on the map, pinned by an admin or manager. Both NULL
-- until someone pins it (existing rows start that way).
ALTER TABLE dormitories
    ADD COLUMN latitude  DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION,
    ADD CONSTRAINT dormitories_location_check CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    );
