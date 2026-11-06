package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type ReferralRepository interface {
	// IssueForProtocol creates a referral for each student of the protocol who
	// doesn't have one from it yet: residents, and applicants whose application
	// wasn't cancelled. Returns the ids of the students it created one for, so
	// calling it again is harmless.
	IssueForProtocol(ctx context.Context, protocolID uuid.UUID, signatoryName string) ([]uuid.UUID, error)
	// GetByToken returns ErrNotFound if no referral has that token.
	GetByToken(ctx context.Context, token string) (*domain.Referral, error)
	// GetLatestByStudent returns ErrNotFound if the student has none.
	GetLatestByStudent(ctx context.Context, studentID uuid.UUID) (*domain.Referral, error)
}
