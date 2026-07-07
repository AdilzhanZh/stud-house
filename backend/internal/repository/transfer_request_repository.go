package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type TransferRequestTx interface {
	SetDecision(ctx context.Context, id uuid.UUID, status domain.TransferRequestStatus, decidedBy uuid.UUID, comment *string) error
}

type TransferRequestRepository interface {
	Create(ctx context.Context, t *domain.TransferRequest) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.TransferRequest, error)
	// GetActiveByStudent returns the student's pending transfer request, if any.
	GetActiveByStudent(ctx context.Context, studentID uuid.UUID) (*domain.TransferRequest, error)
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.TransferRequest, error)
	List(ctx context.Context, status *domain.TransferRequestStatus) ([]*domain.TransferRequest, error)

	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, t *domain.TransferRequest, tx TransferRequestTx) error) error
}
