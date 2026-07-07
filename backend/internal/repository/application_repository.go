package repository

import (
	"context"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// ApplicationTx exposes the writes that must happen atomically together with
// the row lock acquired by ApplicationRepository.WithLock: a status change,
// its audit entry, and (on resubmission) the edited fields.
type ApplicationTx interface {
	// SetDecision finalizes a manager decision: sets status, optionally
	// assigned_room_id (approve only), and handled_by.
	SetDecision(ctx context.Context, id uuid.UUID, status domain.ApplicationStatus, assignedRoomID *uuid.UUID, handledBy uuid.UUID) error
	// UpdateEditableFieldsAndResubmit updates preferred_room_type/notes and
	// moves the status back to pending in one statement.
	UpdateEditableFieldsAndResubmit(ctx context.Context, id uuid.UUID, preferredRoomType, notes *string) error
	AddHistory(ctx context.Context, h *domain.ApplicationStatusHistory) error
}

type ApplicationRepository interface {
	Create(ctx context.Context, a *domain.Application) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Application, error)
	// GetActiveByStudent returns the student's current non-terminal
	// (pending/manager_review/needs_correction) application, if any.
	GetActiveByStudent(ctx context.Context, studentID uuid.UUID) (*domain.Application, error)
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.Application, error)
	// List returns all applications, optionally filtered by status (nil = all).
	List(ctx context.Context, status *domain.ApplicationStatus) ([]*domain.Application, error)
	AddHistory(ctx context.Context, h *domain.ApplicationStatusHistory) error
	ListHistory(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationStatusHistory, error)

	// WithLock locks the application row (SELECT ... FOR UPDATE) inside a DB
	// transaction and invokes fn with the locked snapshot and a transactional
	// handle. The transaction commits if fn returns nil, otherwise it rolls
	// back and WithLock returns fn's error unchanged.
	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, app *domain.Application, tx ApplicationTx) error) error
}
