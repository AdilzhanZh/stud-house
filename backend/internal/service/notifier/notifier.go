// Package notifier sends in-app notifications and, for student recipients,
// mirrors them by email. This is the single choke point every domain
// service calls into, so email delivery only needs to be wired up here
// once rather than duplicated at each call site.
package notifier

import (
	"context"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/mailer"
)

type Notifier struct {
	notifications repository.NotificationRepository
	users         repository.UserRepository
	mailer        *mailer.Mailer
}

func New(notifications repository.NotificationRepository, users repository.UserRepository, m *mailer.Mailer) *Notifier {
	return &Notifier{notifications: notifications, users: users, mailer: m}
}

// Notify records an in-app notification for userID. If userID belongs to a
// student, the same title/body is also emailed to them in the background —
// staff (admin/manager) recipients are not emailed since they get far more
// frequent internal notifications than students do.
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

	if n.mailer.Enabled() {
		if user, err := n.users.GetByID(ctx, userID); err == nil && user.Role == domain.RoleStudent {
			go func(email, subject, body string) {
				if err := n.mailer.Send(email, subject, body); err != nil {
					log.Printf("failed to send notification email to %s: %v", email, err)
				}
			}(user.Email, title, body)
		}
	}
	return nil
}
