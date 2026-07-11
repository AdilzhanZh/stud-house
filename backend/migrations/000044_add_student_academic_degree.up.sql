CREATE TYPE academic_degree_type AS ENUM ('bachelor', 'master');

ALTER TABLE student_profiles ADD COLUMN academic_degree academic_degree_type;
