-- Petition template gains multi-page support (same as contract_template):
-- content_html becomes a single-element pages array so any existing
-- admin-customized wording survives unchanged, just as page 1.
ALTER TABLE petition_template ADD COLUMN pages JSONB;
UPDATE petition_template SET pages = jsonb_build_array(content_html);
ALTER TABLE petition_template ALTER COLUMN pages SET NOT NULL;
ALTER TABLE petition_template DROP COLUMN content_html;
