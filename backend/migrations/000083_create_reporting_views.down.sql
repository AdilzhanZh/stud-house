REVOKE ALL ON stats_application_stages, stats_dormitory_seats FROM stats_reader;
DROP VIEW IF EXISTS stats_resident_requests;
DROP VIEW IF EXISTS stats_contracts;
DROP VIEW IF EXISTS stats_residents;
DROP VIEW IF EXISTS stats_application_benefits;
DROP VIEW IF EXISTS stats_applications;
DROP ROLE IF EXISTS stats_reader;
