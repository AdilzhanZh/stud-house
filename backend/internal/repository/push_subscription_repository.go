package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type PushSubscriptionRepository interface {
	// Save stores the subscription, moving it to s.UserID if the same browser
	// was subscribed for someone else.
	Save(ctx context.Context, s *domain.PushSubscription) error
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.PushSubscription, error)
	// DeleteForUser removes a user's own subscription; a no-op if it isn't theirs.
	DeleteForUser(ctx context.Context, userID uuid.UUID, endpoint string) error
	// DeleteByEndpoint removes a subscription the push service reported gone.
	DeleteByEndpoint(ctx context.Context, endpoint string) error
}
