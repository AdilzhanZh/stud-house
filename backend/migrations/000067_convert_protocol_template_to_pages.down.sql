ALTER TABLE protocol_template ADD COLUMN content_html TEXT;
UPDATE protocol_template SET content_html = pages->>0;
ALTER TABLE protocol_template ALTER COLUMN content_html SET NOT NULL;
ALTER TABLE protocol_template DROP COLUMN pages;
