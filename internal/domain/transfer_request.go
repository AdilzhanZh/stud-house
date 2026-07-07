package domain

import (
	"time"

	"github.com/google/uuid"
)

const NotificationTransferRequestUpdate NotificationType = "transfer_request_update"

type TransferRequestStatus string

const (
	TransferRequestPending  TransferRequestStatus = "pending"
	TransferRequestApproved TransferRequestStatus = "approved"
	TransferRequestRejected TransferRequestStatus = "rejected"
)

// TransferRequest is a settled student's request to move to a different
// room/dormitory. RequestedDormitoryID/RequestedRoomID are non-binding
// hints — approval always requires the manager to supply an explicit
// room_id (see TransferRequestService.Decide).
type TransferRequest struct {
	ID                   uuid.UUID
	StudentID            uuid.UUID
	CurrentRoomID        uuid.UUID
	RequestedDormitoryID *uuid.UUID
	RequestedRoomID      *uuid.UUID
	Reason               *string
	Status               TransferRequestStatus
	DecidedBy            *uuid.UUID
	DecidedAt            *time.Time
	Comment              *string
	CreatedAt            time.Time
}
