package domain

import (
	"time"

	"github.com/google/uuid"
)

// DormObject is the top registry level: the dormitory as an organisation
// with one owner/operator (e.g. the university's student houses, or one
// private dormitory). Its buildings (корпуса) are Dormitory rows — each has
// its own address, floors, rooms and beds. Every Dormitory belongs to
// exactly one object; an object with no buildings left is removed.
//
// DormitoryCount is filled in by queries.
type DormObject struct {
	ID             uuid.UUID
	Name           string
	OwnerName      *string
	BIN            *string
	OwnershipForm  *string
	Phone          *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DormitoryCount int
}

// Floor is one floor of a dormitory building. Number is nil only for the
// "floor not set" placeholder that holds rooms created before floors were
// required; Name is an optional display name ("Цокольный"). A floor is
// never deleted, only retired once it has no rooms, so its id survives.
//
// RoomCount is filled in by queries.
type Floor struct {
	ID          uuid.UUID
	DormitoryID uuid.UUID
	Number      *int
	Name        *string
	CreatedAt   time.Time
	RetiredAt   *time.Time
	RoomCount   int
}

// RegistryRow is one line of the flat registry listing: a bed with the
// full path above it. Levels below an empty level are nil (a building with
// no floors yet has FloorID nil, and so on), so empty buildings, floors and
// rooms still appear.
type RegistryRow struct {
	ObjectID         uuid.UUID
	ObjectName       string
	OwnerName        *string
	OwnershipForm    *string
	DormitoryID      uuid.UUID
	DormitoryName    string
	DormitoryAddress string
	FloorID          *uuid.UUID
	FloorNumber      *int
	FloorName        *string
	RoomID           *uuid.UUID
	RoomNumber       *string
	RoomCapacity     *int
	BedID            *uuid.UUID
	BedInventoryNo   *int64
	BedLabel         *string
	BedOccupied      bool
	BedReserved      bool
	BedService       *BedServiceStatus
	BedServiceReason *string
	BedServiceUntil  *time.Time
}
