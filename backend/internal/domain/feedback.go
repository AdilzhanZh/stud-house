package domain

// NotificationFeedback is a new notification_type enum value (added by a
// dedicated migration, same pattern as NotificationExitRequestUpdate):
// FeedbackService.Send uses it both for the in-app notification and to mark
// the email sent directly to every admin (see notifier.Notifier's usual
// "staff aren't emailed" rule, deliberately bypassed here).
const NotificationFeedback NotificationType = "feedback_message"
