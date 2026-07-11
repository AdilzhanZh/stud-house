-- The dormitory payment QR code feature (admin-set URL, shown to students on
-- the payment page) is removed entirely per product decision.
ALTER TABLE dormitories DROP COLUMN payment_qr_code_url;
