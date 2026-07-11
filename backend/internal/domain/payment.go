package domain

import (
	"time"

	"github.com/google/uuid"
)

const NotificationPaymentUpdate NotificationType = "payment_update"

type PaymentStatus string

const (
	PaymentPending   PaymentStatus = "pending"
	PaymentSubmitted PaymentStatus = "submitted"
	// PaymentAwaitingManagerDecision mirrors ContractAwaitingManagerDecision:
	// passing the payment deadline only flags it for a manager to void
	// (reject the application, free the room, and start a reapply cooldown
	// for the student) or extend — never an automatic rejection by itself
	// (see PaymentService.FlagOverduePayments / ManagerDecision).
	PaymentAwaitingManagerDecision PaymentStatus = "awaiting_manager_decision"
	PaymentConfirmed               PaymentStatus = "confirmed"
	PaymentRejected                PaymentStatus = "rejected"
)

// Payment is created once its Contract is accepted (Amount taken from the
// dormitory's price_per_semester). ReceiptFileURL is filled in when the
// student submits, and ConfirmedBy/ConfirmedAt when a manager decides.
// Deadline is set at creation time (now + PaymentService's configured
// window) — the manager must confirm/reject by then or it gets flagged.
type Payment struct {
	ID             uuid.UUID
	ContractID     uuid.UUID
	Amount         float64
	Currency       string
	ReceiptFileURL *string
	Status         PaymentStatus
	SubmittedAt    *time.Time
	ConfirmedBy    *uuid.UUID
	ConfirmedAt    *time.Time
	Deadline       time.Time
	// ReminderSentAt is set the first (and only) time a deadline-approaching
	// reminder is sent to managers for this payment.
	ReminderSentAt *time.Time
	CreatedAt      time.Time
}
