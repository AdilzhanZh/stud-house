-- price_per_semester was never wired to the dormitory create/edit form (only
-- monthly_payment/yearly_payment are), so it stayed NULL for every
-- dormitory and broke contract payment creation. Contract pricing now reads
-- yearly_payment instead; this column is dead.
ALTER TABLE dormitories DROP COLUMN price_per_semester;
