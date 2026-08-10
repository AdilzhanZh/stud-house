ALTER TABLE petition_template ADD COLUMN content_html TEXT;
UPDATE petition_template SET content_html = pages->>0;
ALTER TABLE petition_template ALTER COLUMN content_html SET NOT NULL;
ALTER TABLE petition_template DROP COLUMN pages;
