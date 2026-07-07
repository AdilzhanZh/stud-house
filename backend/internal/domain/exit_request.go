package domain

import (
	"time"

	"github.com/google/uuid"
)

const NotificationExitRequestUpdate NotificationType = "exit_request_update"

type ExitRequestStatus string

const (
	ExitRequestPending  ExitRequestStatus = "pending"
	ExitRequestApproved ExitRequestStatus = "approved"
	ExitRequestRejected ExitRequestStatus = "rejected"
)

// ExitRequest is a student's request to move out of their current room
// (RoomResidentID). Approval closes that room_residents row (moved_out_at).
type ExitRequest struct {
	ID             uuid.UUID
	RoomResidentID uuid.UUID
	StudentID      uuid.UUID
	Reason         *string
	Status         ExitRequestStatus
	RequestedAt    time.Time
	DecidedBy      *uuid.UUID
	DecidedAt      *time.Time
	Comment        *string
}
