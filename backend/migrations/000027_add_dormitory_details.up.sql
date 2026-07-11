-- Additive columns for the admin "create dormitory" form fields that were
-- missing from phase 1 (phone, type, floor/room counts, yearly payment,
-- built/commissioned year, ownership form, amenity flags). Existing rows get
-- NULL/false, same pattern as 000017's price_per_semester.
CREATE TYPE dormitory_type AS ENUM ('sectional', 'corridor', 'block');

ALTER TABLE dormitories
    ADD COLUMN phone               VARCHAR(50),
    ADD COLUMN dorm_type           dormitory_type,
    ADD COLUMN floor_count         INT,
    ADD COLUMN total_rooms_target  INT,
    ADD COLUMN monthly_payment     NUMERIC(12, 2),
    ADD COLUMN yearly_payment      NUMERIC(12, 2),
    ADD COLUMN built_year          DATE,
    ADD COLUMN commissioned_year   DATE,
    ADD COLUMN ownership_form      VARCHAR(100),
    ADD COLUMN has_ramps           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_elevators       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_handrails       BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN has_parking         BOOLEAN NOT NULL DEFAULT false;
