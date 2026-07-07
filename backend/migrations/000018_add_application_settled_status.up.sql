-- 'settled' marks an application whose student has fully completed the
-- pipeline (contract accepted + payment confirmed). It doesn't fit the
-- phase-2 application_status values, so it's added the same way
-- 'report_review' was added to notification_type in phase 3: an additive
-- ALTER TYPE, with the Go constant declared in a new phase-4 file rather
-- than editing internal/domain/application.go.
ALTER TYPE application_status ADD VALUE 'settled';
