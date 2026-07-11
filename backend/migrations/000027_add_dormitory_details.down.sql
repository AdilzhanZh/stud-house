ALTER TABLE dormitories
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS dorm_type,
    DROP COLUMN IF EXISTS floor_count,
    DROP COLUMN IF EXISTS total_rooms_target,
    DROP COLUMN IF EXISTS monthly_payment,
    DROP COLUMN IF EXISTS yearly_payment,
    DROP COLUMN IF EXISTS built_year,
    DROP COLUMN IF EXISTS commissioned_year,
    DROP COLUMN IF EXISTS ownership_form,
    DROP COLUMN IF EXISTS has_ramps,
    DROP COLUMN IF EXISTS has_elevators,
    DROP COLUMN IF EXISTS has_handrails,
    DROP COLUMN IF EXISTS has_parking;

DROP TYPE IF EXISTS dormitory_type;
