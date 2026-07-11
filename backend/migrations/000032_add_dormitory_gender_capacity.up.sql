-- Breaks total_capacity down by gender allocation (male/female/mixed) for the
-- admin dormitory form — optional, all NULL by default for existing rows.
ALTER TABLE dormitories
    ADD COLUMN capacity_male   INT,
    ADD COLUMN capacity_female INT,
    ADD COLUMN capacity_mixed  INT;
