-- Protocol template gains multi-page support (same as petition_template in
-- migration 000066): content_html becomes a single-element pages array so
-- any existing admin-customized wording survives unchanged, just as page 1.
ALTER TABLE protocol_template ADD COLUMN pages JSONB;
UPDATE protocol_template SET pages = jsonb_build_array(content_html);
ALTER TABLE protocol_template ALTER COLUMN pages SET NOT NULL;
ALTER TABLE protocol_template DROP COLUMN content_html;
