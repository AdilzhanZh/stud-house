package domain

import (
	"time"

	"github.com/google/uuid"
)

// ApplicationSettled is a new application_status value (added via migration,
// same pattern as NotificationProtocolReview) marking that the
// student has accepted their contract. Included in ApplicationStatus.Valid()
// so it can be used as a status query filter (e.g. GET /applications?status=settled
// for room-assignment screens), even though it's only ever set by the system.
const ApplicationSettled ApplicationStatus = "settled"

// NotificationContractSent is a new notification_type enum value (added by
// a dedicated migration, same pattern as NotificationProtocolReview).
const NotificationContractSent NotificationType = "contract_sent"

type ContractStatus string

const (
	ContractSent ContractStatus = "sent"
	// ContractAwaitingManagerDecision replaces phase 4's incorrect
	// "response_deadline passed -> auto expired" behavior: passing the
	// deadline only flags the contract for a manager to void or extend
	// (see ContractService.FlagOverdueContracts / ManagerDecision).
	ContractAwaitingManagerDecision ContractStatus = "awaiting_manager_decision"
	ContractAccepted                ContractStatus = "accepted"
	ContractDeclined                ContractStatus = "declined"
	ContractExpired                 ContractStatus = "expired"
)

// Contract is auto-created (one per application) once that application's
// protocol is approved by committee. The student must accept/decline before
// ResponseDeadline.
type Contract struct {
	ID               uuid.UUID
	ApplicationID    uuid.UUID
	FileURL          string
	Status           ContractStatus
	SentAt           time.Time
	RespondedAt      *time.Time
	ResponseDeadline time.Time
	// ReminderSentAt is set the first (and only) time a
	// deadline-approaching reminder is sent to managers for this contract.
	ReminderSentAt *time.Time
	CreatedAt      time.Time
}
