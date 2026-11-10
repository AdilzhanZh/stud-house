-- stats_residents: back to the 000083 shape (a column can't be dropped with
-- CREATE OR REPLACE, so recreate and re-grant).
DROP VIEW stats_residents;
CREATE VIEW stats_residents AS
SELECT
    d.name AS dormitory_name,
    r.floor,
    sp.gender::text AS gender,
    sp.course,
    sp.academic_degree::text AS academic_degree,
    EXISTS (SELECT 1 FROM student_benefits sb WHERE sb.student_id = rr.student_id) AS has_benefit,
    count(*)::int AS residents
FROM room_residents rr
JOIN rooms r ON r.id = rr.room_id
JOIN dormitories d ON d.id = r.dormitory_id
LEFT JOIN student_profiles sp ON sp.user_id = rr.student_id
WHERE rr.moved_out_at IS NULL
GROUP BY 1, 2, 3, 4, 5, 6;
GRANT SELECT ON stats_residents TO stats_reader;

DROP TRIGGER IF EXISTS floors_keep_dormitory ON floors;
DROP FUNCTION IF EXISTS floors_keep_dormitory();
DROP TRIGGER IF EXISTS floors_sync_rooms ON floors;
DROP FUNCTION IF EXISTS floors_sync_rooms();
DROP TRIGGER IF EXISTS rooms_sync_location ON rooms;
DROP FUNCTION IF EXISTS rooms_sync_location();
ALTER TABLE rooms DROP COLUMN floor_id;
DROP TABLE floors;

DROP TRIGGER IF EXISTS dormitories_drop_empty_object_on_delete ON dormitories;
DROP TRIGGER IF EXISTS dormitories_drop_empty_object_on_move ON dormitories;
DROP FUNCTION IF EXISTS dormitories_drop_empty_object();
DROP TRIGGER IF EXISTS dormitories_default_object ON dormitories;
DROP FUNCTION IF EXISTS dormitories_default_object();

-- The ownership form goes back to each building of the object.
ALTER TABLE dormitories ADD COLUMN ownership_form VARCHAR(100);
UPDATE dormitories d SET ownership_form = o.ownership_form
FROM dorm_objects o WHERE o.id = d.object_id;

ALTER TABLE dormitories DROP COLUMN object_id;
DROP TABLE dorm_objects;
