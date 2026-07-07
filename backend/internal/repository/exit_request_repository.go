package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type ExitRequestTx interface {
	SetDecision(ctx context.Context, id uuid.UUID, status domain.ExitRequestStatus, decidedBy uuid.UUID, comment *string) error
}

type ExitRequestRepository interface {
	Create(ctx context.Context, e *domain.ExitRequest) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.ExitRequest, error)
	// GetActiveByRoomResident returns the pending exit request for a room
	// stay, if any (backs the "one open request per stay" invariant).
	GetActiveByRoomResident(ctx context.Context, roomResidentID uuid.UUID) (*domain.ExitRequest, error)
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.ExitRequest, error)
	List(ctx context.Context, status *domain.ExitRequestStatus) ([]*domain.ExitRequest, error)

	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, exitRequest *domain.ExitRequest, tx ExitRequestTx) error) error
}
