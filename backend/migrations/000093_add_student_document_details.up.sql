-- Study group, hometown and parent contact used to live only on each
-- application, so a student retyped them every time they applied. The profile
-- now holds the current values and prefills the application form; the
-- application keeps its own copy, so documents already issued from it never
-- change when the student later edits their profile.
ALTER TABLE student_profiles
    ADD COLUMN study_group    TEXT,
    ADD COLUMN hometown       TEXT,
    ADD COLUMN parent_contact TEXT;

-- Seed each student's profile from the latest non-empty value of every field
-- across their applications, so nobody has to fill in again what they already
-- entered once.
WITH latest AS (
    SELECT u.id AS user_id,
           (SELECT TRIM(a.study_group) FROM applications a
             WHERE a.student_id = u.id AND NULLIF(TRIM(a.study_group), '') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS study_group,
           (SELECT TRIM(a.hometown) FROM applications a
             WHERE a.student_id = u.id AND NULLIF(TRIM(a.hometown), '') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS hometown,
           (SELECT TRIM(a.parent_contact) FROM applications a
             WHERE a.student_id = u.id AND NULLIF(TRIM(a.parent_contact), '') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS parent_contact
    FROM users u
    WHERE u.role = 'student'
)
INSERT INTO student_profiles (user_id, study_group, hometown, parent_contact)
SELECT user_id, study_group, hometown, parent_contact
FROM latest
WHERE study_group IS NOT NULL OR hometown IS NOT NULL OR parent_contact IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
    SET study_group    = EXCLUDED.study_group,
        hometown       = EXCLUDED.hometown,
        parent_contact = EXCLUDED.parent_contact;
