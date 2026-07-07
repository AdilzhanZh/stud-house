package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// ContractTx exposes the writes that must happen atomically together with
// the row lock acquired by ContractRepository.WithLock.
type ContractTx interface {
	SetStatus(ctx context.Context, id uuid.UUID, status domain.ContractStatus, respondedAt *time.Time) error
	CreatePayment(ctx context.Context, p *domain.Payment) error
	// MarkApplicationRejected writes directly to the phase-2 applications /
	// application_status_history tables (no phase-2 Go file is touched).
	MarkApplicationRejected(ctx context.Context, applicationID uuid.UUID, comment string, changedBy uuid.UUID) error
	// FreeActiveRoomResident closes (moved_out_at = now()) the student's
	// current active room_residents row, if any.
	FreeActiveRoomResident(ctx context.Context, studentID uuid.UUID) error
	// Extend gives the student a new deadline: status back to 'sent',
	// response_deadline replaced, and reminder_sent_at reset so a fresh
	// reminder can fire for the new deadline.
	Extend(ctx context.Context, id uuid.UUID, newDeadline time.Time) error
}

type ContractRepository interface {
	// CreateIfNotExists is idempotent: it returns created=false without
	// error if a contract already exists for c.ApplicationID (defends
	// against the same application ending up in two approved reports).
	CreateIfNotExists(ctx context.Context, c *domain.Contract) (created bool, err error)
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Contract, error)
	GetByApplicationID(ctx context.Context, applicationID uuid.UUID) (*domain.Contract, error)
	// ListExpiredSent returns 'sent' contracts whose response_deadline is
	// already in the past (candidates to flag for manager decision).
	ListExpiredSent(ctx context.Context, now time.Time) ([]*domain.Contract, error)
	// ListApproachingDeadline returns 'sent' contracts whose deadline falls
	// within [from, to] and that haven't had a reminder sent yet.
	ListApproachingDeadline(ctx context.Context, from, to time.Time) ([]*domain.Contract, error)
	MarkReminderSent(ctx context.Context, id uuid.UUID) error
	// List optionally filters by status (nil = all).
	List(ctx context.Context, status *domain.ContractStatus) ([]*domain.Contract, error)
	GetDormitoryPrice(ctx context.Context, dormitoryID uuid.UUID) (*float64, error)

	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, contract *domain.Contract, tx ContractTx) error) error
}
