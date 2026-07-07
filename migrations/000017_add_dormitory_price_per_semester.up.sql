-- Additive column on the phase-1 dormitories table: existing rows get NULL
-- (not yet priced) rather than an arbitrary default. Read/written by new
-- phase-4 code directly via SQL, not through the phase-1 Go repository.
ALTER TABLE dormitories ADD COLUMN price_per_semester NUMERIC(12, 2);
