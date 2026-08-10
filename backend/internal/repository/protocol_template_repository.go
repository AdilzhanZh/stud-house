package repository

import (
	"context"

	"student-house/internal/domain"
)

// ProtocolTemplateRepository backs the single system-wide protocol template
// row (see domain.Protocol). Get returns ErrNotFound before any manager has
// ever saved one — ProtocolTemplateService.Get falls back to a pre-seeded
// default in that case, so callers never see ErrNotFound directly.
type ProtocolTemplateRepository interface {
	Get(ctx context.Context) (*domain.ProtocolTemplate, error)
	Upsert(ctx context.Context, t *domain.ProtocolTemplate) error
}
