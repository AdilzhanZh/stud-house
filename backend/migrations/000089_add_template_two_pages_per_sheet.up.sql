-- Whether a template's PDFs print two pages side by side on a landscape A4
-- sheet instead of one page per portrait sheet. Each template decides for
-- itself: a long protocol benefits, a contract may need to stay full size.
ALTER TABLE protocol_template ADD COLUMN two_pages_per_sheet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE petition_template ADD COLUMN two_pages_per_sheet BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE contract_template ADD COLUMN two_pages_per_sheet BOOLEAN NOT NULL DEFAULT false;
