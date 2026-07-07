// Package notifier sends in-app notifications. Notify only ever writes to
// the notifications table and logs what would have been emailed — there is
// no real SMTP/email integration in this phase.
package notifier

import (
	"context"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type Notifier struct {
	notifications repository.NotificationRepository
}

func New(notifications repository.NotificationRepository) *Notifier {
	return &Notifier{notifications: notifications}
}

// Notify records an in-app notification for userID and stubs out the email
// send. relatedApplicationID may be nil for notifications unrelated to any
// application.
func (n *Notifier) Notify(ctx context.Context, userID uuid.UUID, notifType domain.NotificationType, title, body string, relatedApplicationID *uuid.UUID) error {
	notification := &domain.Notification{
		UserID:               userID,
		Type:                 notifType,
		Title:                title,
		Body:                 body,
		RelatedApplicationID: relatedApplicationID,
	}
	if err := n.notifications.Create(ctx, notification); err != nil {
		return err
	}
	log.Printf("email жіберілер еді: to_user=%s subject=%q body=%q", userID, title, body)
	return nil
}
