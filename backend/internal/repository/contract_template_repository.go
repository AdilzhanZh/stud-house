package repository

import (
	"context"

	"student-house/internal/domain"
)

// ContractTemplateRepository backs the two per-language contract template
// rows, one per domain.ContractLanguage (see domain.ContractTemplate). Get
// returns ErrNotFound before any manager has ever saved the given language —
// ContractTemplateService.Get falls back to a pre-seeded default in that
// case, so callers never see ErrNotFound directly.
type ContractTemplateRepository interface {
	Get(ctx context.Context, language domain.ContractLanguage) (*domain.ContractTemplate, error)
	Upsert(ctx context.Context, t *domain.ContractTemplate) error
}
