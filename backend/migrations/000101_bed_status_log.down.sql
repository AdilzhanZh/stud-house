DROP TRIGGER IF EXISTS beds_log_service_status ON beds;
DROP FUNCTION IF EXISTS beds_log_service_status();
DROP TRIGGER IF EXISTS room_residents_log_bed_status ON room_residents;
DROP FUNCTION IF EXISTS room_residents_log_bed_status();
DROP TRIGGER IF EXISTS applications_log_bed_status ON applications;
DROP FUNCTION IF EXISTS applications_log_bed_status();
DROP FUNCTION IF EXISTS bed_log_status(UUID, TEXT, UUID, UUID);

-- Back to the manual-only history: keep repair/unavailable changes, with
-- "free" meaning in service again.
ALTER TABLE bed_status_history
    DROP CONSTRAINT IF EXISTS bed_status_history_old_status_check,
    DROP CONSTRAINT IF EXISTS bed_status_history_new_status_check;
DELETE FROM bed_status_history
WHERE NOT (new_status IN ('repair', 'unavailable') OR old_status IN ('repair', 'unavailable'));
UPDATE bed_status_history SET old_status = 'in_service' WHERE old_status NOT IN ('repair', 'unavailable');
UPDATE bed_status_history SET new_status = 'in_service' WHERE new_status NOT IN ('repair', 'unavailable');

DROP INDEX IF EXISTS idx_bed_status_history_bed;
ALTER TABLE bed_status_history
    DROP COLUMN IF EXISTS backfilled,
    DROP COLUMN IF EXISTS student_id,
    DROP COLUMN IF EXISTS act_file_url,
    DROP COLUMN IF EXISTS act_date,
    DROP COLUMN IF EXISTS act_number,
    DROP COLUMN IF EXISTS basis_id,
    DROP COLUMN IF EXISTS basis_type,
    DROP COLUMN IF EXISTS seq;
CREATE INDEX idx_bed_status_history_bed ON bed_status_history(bed_id, changed_at DESC);

DROP FUNCTION IF EXISTS student_latest_contract(UUID);
DROP FUNCTION IF EXISTS bed_current_status(UUID);
