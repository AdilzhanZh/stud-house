package domain

import (
	"time"

	"github.com/google/uuid"
)

// RefreshToken stores a hash of an issued refresh token so it can be looked
// up and revoked (logout, rotation) without ever persisting the raw token.
type RefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}
