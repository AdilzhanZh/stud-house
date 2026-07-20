ALTER TABLE dormitories ADD COLUMN default_report_template_id UUID NULL REFERENCES report_templates(id) ON DELETE SET NULL;
