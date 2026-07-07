package domain

import (
	"time"

	"github.com/google/uuid"
)

type Dormitory struct {
	ID               uuid.UUID
	Name             string
	Address          string
	TotalCapacity    int
	PaymentQRCodeURL *string
	CreatedBy        uuid.UUID
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// DormitoryCapacity reports how many beds have been allocated across a
// dormitory's rooms versus its declared total_capacity.
type DormitoryCapacity struct {
	DormitoryID   uuid.UUID
	TotalCapacity int
	AllocatedBeds int
}

type DormitoryImage struct {
	ID          uuid.UUID
	DormitoryID uuid.UUID
	ImageURL    string
	CreatedAt   time.Time
}
