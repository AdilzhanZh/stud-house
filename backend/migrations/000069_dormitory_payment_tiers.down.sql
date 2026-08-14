ALTER TABLE dormitories
    DROP COLUMN monthly_payment_bachelor,
    DROP COLUMN monthly_payment_master,
    DROP COLUMN monthly_payment_doctorate,
    DROP COLUMN yearly_payment_bachelor,
    DROP COLUMN yearly_payment_master,
    DROP COLUMN yearly_payment_doctorate,
    ADD COLUMN monthly_payment NUMERIC(12, 2),
    ADD COLUMN yearly_payment  NUMERIC(12, 2);

ALTER TABLE dormitories
    ADD COLUMN rooms_male   INT,
    ADD COLUMN rooms_female INT,
    ADD COLUMN rooms_mixed  INT;
