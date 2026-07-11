ALTER TABLE dormitories
    ADD COLUMN has_ramps     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_elevators BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_handrails BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_parking   BOOLEAN NOT NULL DEFAULT false;
