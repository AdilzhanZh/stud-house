// Package notifier sends in-app notifications and mirrors them to the
// recipient: by email for students, and by push to any device the recipient
// subscribed. This is the single choke point every domain service calls into,
// so delivery only needs to be wired up here once rather than duplicated at
// each call site.
package notifier

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/mailer"
)

// PushMessage is what a phone shows; URL is the page a tap opens.
type PushMessage struct {
	Title string
	Body  string
	URL   string
}

// Pusher delivers a push message to a user's subscribed devices
// (service.PushService). Kept as an interface so this package needn't
// depend on the service package.
type Pusher interface {
	Push(ctx context.Context, userID uuid.UUID, msg PushMessage)
}

// pushTimeout bounds one notification's push delivery, which runs after the
// request that caused it has already returned.
const pushTimeout = 30 * time.Second

type Notifier struct {
	notifications repository.NotificationRepository
	users         repository.UserRepository
	mailer        *mailer.Mailer
	pusher        Pusher
}

func New(notifications repository.NotificationRepository, users repository.UserRepository, m *mailer.Mailer) *Notifier {
	return &Notifier{notifications: notifications, users: users, mailer: m}
}

// SetPusher turns on push delivery. Without it, notifications go to the app
// and email only.
func (n *Notifier) SetPusher(p Pusher) { n.pusher = p }

// Notify records an in-app notification for userID. If userID belongs to a
// student, the same title/body is also emailed to them in the background —
// staff (admin/manager) recipients are not emailed since they get far more
// frequent internal notifications than students do. Push goes to everyone
// who subscribed a device, staff included: they opted in themselves.
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

	if !n.mailer.Enabled() && n.pusher == nil {
		return nil
	}
	user, err := n.users.GetByID(ctx, userID)
	if err != nil {
		return nil
	}

	if n.mailer.Enabled() && user.Role == domain.RoleStudent && user.Email != "" {
		go func(email, subject, body string) {
			if err := n.mailer.Send(email, subject, body); err != nil {
				log.Printf("failed to send notification email to %s: %v", email, err)
			}
		}(user.Email, title, body)
	}

	if n.pusher != nil {
		msg := PushMessage{Title: title, Body: body, URL: pushURL(user.Role, relatedApplicationID)}
		go func() {
			pushCtx, cancel := context.WithTimeout(context.Background(), pushTimeout)
			defer cancel()
			n.pusher.Push(pushCtx, userID, msg)
		}()
	}
	return nil
}

// pushURL is where tapping the notification leads: a student's own
// application when there is one, otherwise their notifications list; staff
// land on the list in their own panel.
func pushURL(role domain.Role, relatedApplicationID *uuid.UUID) string {
	if role != domain.RoleStudent {
		return "/admin/notifications"
	}
	if relatedApplicationID != nil {
		return "/applications/" + relatedApplicationID.String()
	}
	return "/notifications"
}
