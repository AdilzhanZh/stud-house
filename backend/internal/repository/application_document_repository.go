package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type ApplicationDocumentRepository interface {
	Add(ctx context.Context, d *domain.ApplicationDocument) error
	ListByApplication(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationDocument, error)
}
