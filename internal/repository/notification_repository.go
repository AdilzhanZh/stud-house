package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type NotificationRepository interface {
	Create(ctx context.Context, n *domain.Notification) error
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Notification, error)
	// MarkRead only succeeds if the notification belongs to userID.
	MarkRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error
}
