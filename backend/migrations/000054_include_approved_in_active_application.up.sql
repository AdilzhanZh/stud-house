-- A student may only re-apply once their prior application is rejected (or
-- resubmitted via needs_correction) — an 'approved' application (awaiting or
-- during the contract/payment flow) must also block a new one, otherwise a
-- student could apply to a second dormitory while their first is already
-- approved. Contract decline/void/expiry already flips the application back
-- to 'rejected' (see ContractService), so this never traps a student.
DROP INDEX uniq_applications_active_student;

CREATE UNIQUE INDEX uniq_applications_active_student ON applications(student_id)
    WHERE status IN ('pending', 'manager_review', 'needs_correction', 'approved');
