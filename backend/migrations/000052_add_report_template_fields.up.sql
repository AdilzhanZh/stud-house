-- file_url stays but becomes optional: the new in-app template builder no
-- longer requires an uploaded file, but ContractService.OnReportApproved
-- still copies a report template's file_url into Contract.file_url (the
-- student-facing "Open PDF" link on the contract) when one was attached.
ALTER TABLE report_templates ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE report_templates ALTER COLUMN file_url DROP DEFAULT;
ALTER TABLE report_templates ADD COLUMN intro_text TEXT NOT NULL DEFAULT '';
ALTER TABLE report_templates ADD COLUMN student_columns TEXT[] NOT NULL DEFAULT '{full_name}';
