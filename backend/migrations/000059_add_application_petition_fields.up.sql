-- Fields required by the printed "Өтініш" (dormitory placement petition)
-- document, which the site will auto-generate per approved application.
-- Nullable at the DB level (existing rows predate this and phone/full
-- name/date come from the student's account, not from these columns) —
-- ApplicationService.Create enforces them as required for new submissions.
ALTER TABLE applications
    ADD COLUMN study_group VARCHAR(50),
    ADD COLUMN hometown VARCHAR(255),
    ADD COLUMN parent_contact VARCHAR(30);
