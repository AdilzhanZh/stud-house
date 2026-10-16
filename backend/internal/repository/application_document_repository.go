package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type ApplicationDocumentRepository interface {
	Add(ctx context.Context, d *domain.ApplicationDocument) error
	ListByApplication(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationDocument, error)
	// ListMissingRequired returns, for each given application, every
	// required document (its dormitory's, plus those of every benefit its
	// student currently holds) that has no matching upload on it.
	ListMissingRequired(ctx context.Context, applicationIDs []uuid.UUID) ([]*domain.MissingRequiredDocument, error)
}
