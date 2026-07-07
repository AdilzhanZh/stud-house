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
	PaymentConfirmed PaymentStatus = "confirmed"
	PaymentRejected  PaymentStatus = "rejected"
)

// Payment is created once its Contract is accepted (Amount taken from the
// dormitory's price_per_semester). ReceiptFileURL is filled in when the
// student submits, and ConfirmedBy/ConfirmedAt when a manager decides.
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
	CreatedAt      time.Time
}
