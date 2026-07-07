-- Report-review notifications (sent to committee members / the report's
-- manager) don't fit the phase-2 notification types, which are both tied to
-- a single application. Adding a value to an existing enum is additive and
-- doesn't touch the phase-2 migration that created notification_type.
ALTER TYPE notification_type ADD VALUE 'report_review';
