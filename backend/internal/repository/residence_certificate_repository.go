package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type ResidenceCertificateRepository interface {
	// Issue snapshots the student's current stay and profile into a new
	// certificate. Returns ErrNotFound if the student lives in no room now.
	Issue(ctx context.Context, studentID uuid.UUID, signatoryName string) (*domain.ResidenceCertificate, error)
	// GetByToken returns ErrNotFound if no certificate has that token.
	GetByToken(ctx context.Context, token string) (*domain.ResidenceCertificate, error)
	// GetLatestByStudent returns ErrNotFound if the student has none.
	GetLatestByStudent(ctx context.Context, studentID uuid.UUID) (*domain.ResidenceCertificate, error)
}
