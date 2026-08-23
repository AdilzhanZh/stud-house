-- Once the yearly academic-year rollover (see AcademicYearService) would
-- push a student's course past their academic degree's max course (see
-- domain.AcademicDegree.MaxCourse), they graduate instead of advancing
-- further. 'graduated' blocks login the same way 'rejected' does, just with
-- its own message. Same pattern as migration 000071 (ADD VALUE, no down —
-- Postgres can't drop an enum value).
ALTER TYPE user_approval_status ADD VALUE 'graduated';
