package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// PaymentTx exposes the writes that must happen atomically together with
// the row lock acquired by PaymentRepository.WithLock.
type PaymentTx interface {
	SetSubmitted(ctx context.Context, id uuid.UUID, receiptFileURL string) error
	SetDecision(ctx context.Context, id uuid.UUID, status domain.PaymentStatus, confirmedBy uuid.UUID) error
	// MarkApplicationSettled writes directly to the phase-2 applications /
	// application_status_history tables.
	MarkApplicationSettled(ctx context.Context, applicationID uuid.UUID, changedBy uuid.UUID) error
	// SetStatus is a plain status transition with no side table writes (used
	// to flag a payment awaiting_manager_decision).
	SetStatus(ctx context.Context, id uuid.UUID, status domain.PaymentStatus) error
	// MarkApplicationRejected mirrors ContractTx's method of the same name,
	// used by ManagerDecision(action="void").
	MarkApplicationRejected(ctx context.Context, applicationID uuid.UUID, comment string, changedBy uuid.UUID) error
	// FreeActiveRoomResident mirrors ContractTx's method of the same name.
	FreeActiveRoomResident(ctx context.Context, studentID uuid.UUID) error
	// Extend gives a new deadline: status reverts to 'submitted' if a
	// receipt was already on file, otherwise 'pending', and
	// reminder_sent_at is reset so a fresh reminder can fire.
	Extend(ctx context.Context, id uuid.UUID, newDeadline time.Time) error
}

type PaymentRepository interface {
	Create(ctx context.Context, p *domain.Payment) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Payment, error)
	GetByContractID(ctx context.Context, contractID uuid.UUID) (*domain.Payment, error)
	// ListByStudent joins through contracts->applications.student_id, since
	// payments carry no student_id of their own (kezeng 3 frontend: GET
	// /payments/my).
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.Payment, error)
	// List optionally filters by status (nil = all), for the manager's
	// payment review queue (kezeng 6 frontend: GET /payments?status=).
	List(ctx context.Context, status *domain.PaymentStatus) ([]*domain.Payment, error)
	// ListExpiredPending returns 'pending'/'submitted' payments whose
	// deadline is already in the past (candidates to flag for manager
	// decision).
	ListExpiredPending(ctx context.Context, now time.Time) ([]*domain.Payment, error)
	// ListApproachingDeadline returns 'pending'/'submitted' payments whose
	// deadline falls within [from, to] and that haven't had a reminder sent yet.
	ListApproachingDeadline(ctx context.Context, from, to time.Time) ([]*domain.Payment, error)
	MarkReminderSent(ctx context.Context, id uuid.UUID) error

	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, payment *domain.Payment, tx PaymentTx) error) error
}
