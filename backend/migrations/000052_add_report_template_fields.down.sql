ALTER TABLE report_templates DROP COLUMN student_columns;
ALTER TABLE report_templates DROP COLUMN intro_text;
UPDATE report_templates SET file_url = '' WHERE file_url IS NULL;
ALTER TABLE report_templates ALTER COLUMN file_url SET DEFAULT '';
ALTER TABLE report_templates ALTER COLUMN file_url SET NOT NULL;
