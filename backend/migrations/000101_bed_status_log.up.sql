-- Bed status log. bed_status_history used to record only the manual
-- repair/unavailable changes. It now records every change of a bed place's
-- status (free, reserved, occupied, repair, unavailable), each with:
--   changed_at, changed_by    when and who (NULL changed_by = the system,
--                             e.g. a scheduled job);
--   old_status, new_status    the previous and the new status;
--   basis_type, basis_id      the document behind the change:
--     application       заявление на заселение (applications.id)
--     reservation       бронь, the hold an application keeps (applications.id)
--     contract          договор (contracts.id)
--     exit_request      заявление на выселение (exit_requests.id)
--     transfer_request  заявление на перевод (transfer_requests.id)
--     act               акт — act_number / act_date / act_file_url;
--   student_id                the student the change concerns, if any;
--   backfilled                true for entries rebuilt below from data
--                             older than the log (author/basis may be
--                             unknown there).
--
-- Rows are written by database triggers, so every code path that changes a
-- bed's status is covered. The backend passes the author and, where it knows
-- better than the trigger, the basis through session settings (app.bed_*,
-- set per request in the connection pool, see postgres.NewPool).

ALTER TABLE bed_status_history
    ADD COLUMN seq          BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD COLUMN basis_type   VARCHAR(20)
        CHECK (basis_type IN ('application', 'reservation', 'contract', 'exit_request', 'transfer_request', 'act')),
    ADD COLUMN basis_id     UUID,
    ADD COLUMN act_number   VARCHAR(100),
    ADD COLUMN act_date     DATE,
    ADD COLUMN act_file_url TEXT,
    ADD COLUMN student_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN backfilled   BOOLEAN NOT NULL DEFAULT false;

-- bed_current_status works out a bed's status the same way domain.Bed.Status
-- does: occupied > reserved > repair/unavailable > free.
CREATE FUNCTION bed_current_status(p_bed UUID) RETURNS TEXT AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM room_residents
                     WHERE bed_id = p_bed AND moved_out_at IS NULL) THEN 'occupied'
        WHEN EXISTS (SELECT 1 FROM applications
                     WHERE held_bed_id = p_bed
                       AND status IN ('pending', 'manager_review', 'approved')) THEN 'reserved'
        WHEN b.service_status = 'repair' THEN 'repair'
        WHEN b.service_status = 'unavailable' THEN 'unavailable'
        ELSE 'free'
    END
    FROM beds b WHERE b.id = p_bed;
$$ LANGUAGE sql STABLE;

-- The student's contract: the one of their most recent application that
-- has one.
CREATE FUNCTION student_latest_contract(p_student UUID) RETURNS UUID AS $$
    SELECT c.id FROM contracts c
    JOIN applications a ON a.id = c.application_id
    WHERE a.student_id = p_student
    ORDER BY c.created_at DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

-- ---------------------------------------------------------------------------
-- Backfill: rebuild the log from what the database already knows, oldest
-- first, so every bed has a history that ends in its current status.
--   * stays: free → occupied at move-in, occupied → free at move-out (basis:
--     the approved exit request for that stay, else the student's contract);
--   * active holds: → reserved at the application's last update (when it
--     last moved; the exact moment wasn't recorded);
--   * the existing manual repair/unavailable rows (basis: act, number unknown).
-- old_status is recomputed from the order of events, and events that don't
-- change the status are dropped.
CREATE TEMP TABLE bed_events AS
SELECT h.bed_id, h.changed_at AS at,
       CASE h.new_status WHEN 'in_service' THEN 'free' ELSE h.new_status END AS new_status,
       h.changed_by, h.reason, h.until,
       'act'::text AS basis_type, NULL::uuid AS basis_id, NULL::uuid AS student_id, 3 AS prio
FROM bed_status_history h
UNION ALL
SELECT rr.bed_id, rr.moved_in_at, 'occupied', NULL, NULL, NULL,
       CASE WHEN student_latest_contract(rr.student_id) IS NULL THEN NULL ELSE 'contract' END,
       student_latest_contract(rr.student_id), rr.student_id, 2
FROM room_residents rr WHERE rr.bed_id IS NOT NULL
UNION ALL
SELECT rr.bed_id, rr.moved_out_at, 'free', er.decided_by, NULL, NULL,
       CASE WHEN er.id IS NOT NULL THEN 'exit_request'
            WHEN student_latest_contract(rr.student_id) IS NOT NULL THEN 'contract' END,
       COALESCE(er.id, student_latest_contract(rr.student_id)), rr.student_id, 1
FROM room_residents rr
LEFT JOIN LATERAL (SELECT e.id, e.decided_by FROM exit_requests e
                   WHERE e.room_resident_id = rr.id AND e.status = 'approved'
                   ORDER BY e.decided_at DESC NULLS LAST LIMIT 1) er ON true
WHERE rr.bed_id IS NOT NULL AND rr.moved_out_at IS NOT NULL
UNION ALL
SELECT a.held_bed_id, a.updated_at, 'reserved', NULL, NULL, NULL,
       'application', a.id, a.student_id, 2
FROM applications a
WHERE a.held_bed_id IS NOT NULL AND a.status IN ('pending', 'manager_review', 'approved');

DELETE FROM bed_status_history;

INSERT INTO bed_status_history
    (bed_id, old_status, new_status, reason, until, changed_by, changed_at, basis_type, basis_id, student_id, backfilled)
SELECT bed_id, old_status, new_status, reason, until, changed_by, at, basis_type, basis_id, student_id, true
FROM (
    SELECT e.*, LAG(e.new_status, 1, 'free') OVER w AS old_status, row_number() OVER w AS n
    FROM bed_events e
    WINDOW w AS (PARTITION BY e.bed_id ORDER BY e.at, e.prio)
) x
WHERE new_status <> old_status
ORDER BY bed_id, n;

DROP TABLE bed_events;

-- Beds whose rebuilt history doesn't end in their current status (e.g. a
-- repair mark set before the manual log existed) get one closing row.
INSERT INTO bed_status_history (bed_id, old_status, new_status, reason, until, changed_at, backfilled)
SELECT b.id, COALESCE(last.new_status, 'free'), bed_current_status(b.id),
       CASE WHEN b.service_status <> 'in_service' THEN b.service_reason END,
       CASE WHEN b.service_status <> 'in_service' THEN b.service_until END,
       now(), true
FROM beds b
LEFT JOIN LATERAL (SELECT h.new_status FROM bed_status_history h
                   WHERE h.bed_id = b.id ORDER BY h.seq DESC LIMIT 1) last ON true
WHERE COALESCE(last.new_status, 'free') <> bed_current_status(b.id);

ALTER TABLE bed_status_history
    ADD CONSTRAINT bed_status_history_old_status_check
        CHECK (old_status IN ('free', 'reserved', 'occupied', 'repair', 'unavailable')),
    ADD CONSTRAINT bed_status_history_new_status_check
        CHECK (new_status IN ('free', 'reserved', 'occupied', 'repair', 'unavailable'));
DROP INDEX idx_bed_status_history_bed;
CREATE INDEX idx_bed_status_history_bed ON bed_status_history(bed_id, seq DESC);

-- ---------------------------------------------------------------------------
-- bed_log_status writes a log row if the bed's status differs from the last
-- one logged. The session settings app.bed_* (author, basis, act) win over
-- the trigger's own guess of the basis.
CREATE FUNCTION bed_log_status(p_bed UUID, p_basis_type TEXT, p_basis_id UUID, p_student UUID)
RETURNS void AS $$
DECLARE
    v_new TEXT := bed_current_status(p_bed);
    v_old TEXT;
    v_ctx_basis TEXT := NULLIF(current_setting('app.bed_basis_type', true), '');
    v_bed beds%ROWTYPE;
BEGIN
    IF v_new IS NULL THEN
        RETURN;
    END IF;
    SELECT h.new_status INTO v_old FROM bed_status_history h
    WHERE h.bed_id = p_bed ORDER BY h.seq DESC LIMIT 1;
    v_old := COALESCE(v_old, 'free');
    IF v_new = v_old THEN
        RETURN;
    END IF;
    SELECT * INTO v_bed FROM beds WHERE id = p_bed;

    INSERT INTO bed_status_history
        (bed_id, old_status, new_status, reason, until, changed_by,
         basis_type, basis_id, act_number, act_date, act_file_url, student_id)
    VALUES (
        p_bed, v_old, v_new,
        CASE WHEN v_new IN ('repair', 'unavailable') THEN v_bed.service_reason END,
        CASE WHEN v_new IN ('repair', 'unavailable') THEN v_bed.service_until END,
        NULLIF(current_setting('app.bed_actor', true), '')::uuid,
        COALESCE(v_ctx_basis, p_basis_type),
        CASE WHEN v_ctx_basis IS NOT NULL
             THEN NULLIF(current_setting('app.bed_basis_id', true), '')::uuid
             ELSE p_basis_id END,
        NULLIF(current_setting('app.bed_act_number', true), ''),
        NULLIF(current_setting('app.bed_act_date', true), '')::date,
        NULLIF(current_setting('app.bed_act_file_url', true), ''),
        p_student
    );
END;
$$ LANGUAGE plpgsql;

-- Reservations: an application taking, moving or releasing its bed. A new
-- application is the basis for its first reservation (заявление); later
-- changes of the hold have the reservation itself as basis (бронь).
CREATE FUNCTION applications_log_bed_status() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.held_bed_id IS NOT NULL
       AND OLD.held_bed_id IS DISTINCT FROM NEW.held_bed_id THEN
        PERFORM bed_log_status(OLD.held_bed_id, 'reservation', NEW.id, NEW.student_id);
    END IF;
    IF NEW.held_bed_id IS NOT NULL THEN
        PERFORM bed_log_status(NEW.held_bed_id,
            CASE WHEN TG_OP = 'INSERT' THEN 'application' ELSE 'reservation' END,
            NEW.id, NEW.student_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER applications_log_bed_status
    AFTER INSERT OR UPDATE OF held_bed_id, status ON applications
    FOR EACH ROW EXECUTE FUNCTION applications_log_bed_status();

-- Stays: moving in and out. Unless the backend names another basis (exit or
-- transfer request), the student's contract is the basis (договор).
CREATE FUNCTION room_residents_log_bed_status() RETURNS trigger AS $$
DECLARE
    v_contract UUID := student_latest_contract(NEW.student_id);
    v_type TEXT := CASE WHEN v_contract IS NULL THEN NULL ELSE 'contract' END;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.bed_id IS NOT NULL AND OLD.bed_id IS DISTINCT FROM NEW.bed_id THEN
        PERFORM bed_log_status(OLD.bed_id, v_type, v_contract, NEW.student_id);
    END IF;
    IF NEW.bed_id IS NOT NULL THEN
        PERFORM bed_log_status(NEW.bed_id, v_type, v_contract, NEW.student_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_residents_log_bed_status
    AFTER INSERT OR UPDATE OF moved_out_at, bed_id ON room_residents
    FOR EACH ROW EXECUTE FUNCTION room_residents_log_bed_status();

-- Repair / unavailable / back in service: the basis is an act.
CREATE FUNCTION beds_log_service_status() RETURNS trigger AS $$
BEGIN
    PERFORM bed_log_status(NEW.id, 'act', NULL, NULL);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beds_log_service_status
    AFTER UPDATE OF service_status ON beds
    FOR EACH ROW EXECUTE FUNCTION beds_log_service_status();
