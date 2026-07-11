-- The male/female/mixed breakdown is counted by rooms (matching
-- total_rooms_target), not by bed capacity — rename to reflect that.
ALTER TABLE dormitories RENAME COLUMN capacity_male TO rooms_male;
ALTER TABLE dormitories RENAME COLUMN capacity_female TO rooms_female;
ALTER TABLE dormitories RENAME COLUMN capacity_mixed TO rooms_mixed;
