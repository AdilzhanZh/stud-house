package domain

import (
	"time"

	"github.com/google/uuid"
)

type NotificationType string

const (
	NotificationApplicationStatusChanged NotificationType = "application_status_changed"
	NotificationDocumentRequested        NotificationType = "document_requested"
)

// Notification is an in-app message. Sending it does not involve any real
// email/SMTP delivery in this phase — see internal/service/notifier.
type Notification struct {
	ID                   uuid.UUID
	UserID               uuid.UUID
	Type                 NotificationType
	Title                string
	Body                 string
	IsRead               bool
	RelatedApplicationID *uuid.UUID
	CreatedAt            time.Time
}
