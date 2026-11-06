package domain

import (
	"time"

	"github.com/google/uuid"
)

// PushSubscription is one browser's consent to receive push notifications for
// a user: where to send them (Endpoint, run by the browser's push service) and
// the keys to encrypt them with (P256dh, Auth), as the Push API hands them out.
type PushSubscription struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	Endpoint  string
	P256dh    string
	Auth      string
	UserAgent string
	CreatedAt time.Time
}
