-- Singleton table (mirrors protocol_template, migration 000063): tracks the
-- last academic year AcademicYearService already advanced everyone's
-- course for, so the yearly rollover only ever runs once per year no
-- matter how many times the background check ticks or how late it runs
-- after the July 30 cutoff (e.g. the server having been down that day).
CREATE TABLE academic_year_rollover_state (
    id                    UUID PRIMARY KEY,
    last_rolled_over_year SMALLINT,
    CONSTRAINT academic_year_rollover_state_singleton CHECK (id = '00000000-0000-0000-0000-000000000003')
);

INSERT INTO academic_year_rollover_state (id, last_rolled_over_year) VALUES ('00000000-0000-0000-0000-000000000003', NULL);
