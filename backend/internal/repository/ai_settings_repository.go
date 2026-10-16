package repository

import (
	"context"

	"student-house/internal/domain"
)

type AISettingsRepository interface {
	// Get returns ErrNotFound until settings have been saved once.
	Get(ctx context.Context) (*domain.AISettings, error)
	Save(ctx context.Context, s *domain.AISettings) error
}
