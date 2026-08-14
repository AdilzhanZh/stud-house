-- rooms_male/rooms_female/rooms_mixed duplicated data that's now derived
-- from the actual rooms created under a dormitory (gender restriction on
-- each room), so the admin "create dormitory" form no longer collects it.
ALTER TABLE dormitories
    DROP COLUMN rooms_male,
    DROP COLUMN rooms_female,
    DROP COLUMN rooms_mixed;

-- monthly_payment/yearly_payment become per-degree-level tiers: a
-- dormitory can charge bachelor/master/doctorate students differently.
ALTER TABLE dormitories
    DROP COLUMN monthly_payment,
    DROP COLUMN yearly_payment,
    ADD COLUMN monthly_payment_bachelor  NUMERIC(12, 2),
    ADD COLUMN monthly_payment_master    NUMERIC(12, 2),
    ADD COLUMN monthly_payment_doctorate NUMERIC(12, 2),
    ADD COLUMN yearly_payment_bachelor   NUMERIC(12, 2),
    ADD COLUMN yearly_payment_master     NUMERIC(12, 2),
    ADD COLUMN yearly_payment_doctorate  NUMERIC(12, 2);
