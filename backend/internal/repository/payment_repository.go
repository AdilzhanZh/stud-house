package repository

import (
	"context"

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
}

type PaymentRepository interface {
	Create(ctx context.Context, p *domain.Payment) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Payment, error)
	GetByContractID(ctx context.Context, contractID uuid.UUID) (*domain.Payment, error)
	// ListByStudent joins through contracts->applications.student_id, since
	// payments carry no student_id of their own (kezeng 3 frontend: GET
	// /payments/my).
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.Payment, error)

	WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, payment *domain.Payment, tx PaymentTx) error) error
}
