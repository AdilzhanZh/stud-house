-- Backs the student-facing "send a bug report / suggestion to the admin"
-- feature (FeedbackService.Send): a manually composed message from any
-- authenticated user, delivered to every admin as both an in-app
-- notification and an email (bypassing Notifier's usual "staff aren't
-- emailed" rule, since here the whole point is that the admin's inbox
-- receives it).
ALTER TYPE notification_type ADD VALUE 'feedback_message';
