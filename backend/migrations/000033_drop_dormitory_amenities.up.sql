-- The amenity flags (ramps/elevators/handrails/parking) are removed from the
-- admin dormitory form per product decision.
ALTER TABLE dormitories
    DROP COLUMN has_ramps,
    DROP COLUMN has_elevators,
    DROP COLUMN has_handrails,
    DROP COLUMN has_parking;
