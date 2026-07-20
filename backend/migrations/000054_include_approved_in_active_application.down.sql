DROP INDEX uniq_applications_active_student;

CREATE UNIQUE INDEX uniq_applications_active_student ON applications(student_id)
    WHERE status IN ('pending', 'manager_review', 'needs_correction');
