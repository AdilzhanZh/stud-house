package repository

import (
	"context"

	"student-house/internal/domain"
)

type AISettingsRepository interface {
	// Get returns ErrNotFound until settings have been saved once.
	Get(ctx context.Context) (*domain.AISettings, error)
	Save(ctx context.Context, s *domain.AISettings) error

	// GetAPIKey returns ErrNotFound when no admin-set key is stored.
	GetAPIKey(ctx context.Context) (*domain.AIAPIKey, error)
	SaveAPIKey(ctx context.Context, k *domain.AIAPIKey) error
	DeleteAPIKey(ctx context.Context) error
}
