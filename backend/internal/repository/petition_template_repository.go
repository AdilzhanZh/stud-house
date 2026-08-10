package repository

import (
	"context"

	"student-house/internal/domain"
)

// PetitionTemplateRepository backs the single system-wide petition template
// row (see domain.PetitionTemplate). Get returns ErrNotFound before any
// manager has ever saved one — PetitionTemplateService.Get falls back to a
// pre-seeded default in that case, so callers never see ErrNotFound directly.
type PetitionTemplateRepository interface {
	Get(ctx context.Context) (*domain.PetitionTemplate, error)
	Upsert(ctx context.Context, t *domain.PetitionTemplate) error
}
