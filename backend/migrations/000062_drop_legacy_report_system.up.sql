-- The "report"/committee-review system (reports, report_templates,
-- report_applications, committee_votes, dormitories.default_report_template_id)
-- is being replaced end-to-end by a "protocol" system (see migration 000063)
-- that matches the actual paper "Хаттама" workflow — see the domain
-- rewrite in internal/domain/protocol.go. Dropped in dependency order.

-- The auto-register-on-approval feature (a dormitory's configured default
-- report template) goes away with it: the new protocol flow is fully
-- manual (a manager explicitly picks students to prepare a protocol for).
ALTER TABLE dormitories DROP COLUMN default_report_template_id;

DROP TABLE committee_votes;
DROP TABLE report_applications;
DROP TABLE reports;
DROP TABLE report_templates;

DROP TYPE report_status;
DROP TYPE report_vote_decision;

ALTER TYPE notification_type RENAME VALUE 'report_review' TO 'protocol_review';
