package repository

import (
	"context"

	"student-house/internal/domain"
)

// ReferralTemplateRepository backs the single referral template row. Get returns
// ErrNotFound until someone first saves it.
type ReferralTemplateRepository interface {
	Get(ctx context.Context) (*domain.ReferralTemplate, error)
	Upsert(ctx context.Context, t *domain.ReferralTemplate) error
}
