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
	// UpdateEditableFieldsAndResubmit updates preferred_room_type/notes/
	// preferred_room_id and moves the status back to pending in one
	// statement. preferredRoomID is nil when the student didn't (re-)pick a
	// room this time — it leaves the column untouched, it does not clear it.
	UpdateEditableFieldsAndResubmit(ctx context.Context, id uuid.UUID, preferredRoomType, notes *string, preferredRoomID *uuid.UUID) error
	// ClearPreferredRoom nulls preferred_room_id — used when an application
	// enters needs_correction, releasing any room hold it held.
	ClearPreferredRoom(ctx context.Context, id uuid.UUID) error
	AddHistory(ctx context.Context, h *domain.ApplicationStatusHistory) error
}

type ApplicationRepository interface {
	Create(ctx context.Context, a *domain.Application) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Application, error)
	// GetActiveByStudent returns the student's current non-terminal
	// (pending/manager_review/needs_correction/approved) application, if any
	// — a student may only re-apply once it's rejected.
	GetActiveByStudent(ctx context.Context, studentID uuid.UUID) (*domain.Application, error)
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.Application, error)
	// List returns all applications, optionally filtered by status (nil = all).
	List(ctx context.Context, status *domain.ApplicationStatus) ([]*domain.Application, error)
	// ListByDormitory is used by DormitoryService.Delete to check whether a
	// dormitory still has non-rejected applications before allowing removal.
	ListByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.Application, error)
	AddHistory(ctx context.Context, h *domain.ApplicationStatusHistory) error
	ListHistory(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationStatusHistory, error)
	// Delete removes a single (already-rejected) application, e.g. when its
	// dormitory is being deleted. Returns ErrConflict if some other row
	// (contract, protocol) still references it.
	Delete(ctx context.Context, id uuid.UUID) error

	// WithLock locks the application row (SELECT ... FOR UPDATE) inside a DB
	// transaction and invokes fn with the locked snapshot and a transactional
	// handle. The transaction commits if fn returns nil, otherwise it rolls
	// back and WithLock returns fn's error unchanged.
	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, app *domain.Application, tx ApplicationTx) error) error
}
