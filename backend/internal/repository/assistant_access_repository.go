package repository

import (
	"context"

	"student-house/internal/domain"
)

type AssistantAccessRepository interface {
	// Get returns ErrNotFound until an admin has saved access once.
	Get(ctx context.Context) (*domain.AssistantAccess, error)
	Save(ctx context.Context, a *domain.AssistantAccess) error
}
