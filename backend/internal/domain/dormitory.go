package domain

import (
	"time"

	"github.com/google/uuid"
)

type DormitoryType string

const (
	DormitorySectional DormitoryType = "sectional"
	DormitoryCorridor  DormitoryType = "corridor"
	DormitoryBlock     DormitoryType = "block"
)

type Dormitory struct {
	ID               uuid.UUID
	Name             string
	Address          string
	Phone            *string
	Type             *DormitoryType
	FloorCount       *int
	TotalRoomsTarget *int
	TotalCapacity    int
	// Payment tiers vary by academic degree — a dormitory can charge
	// bachelor/master/doctorate students differently.
	MonthlyPaymentBachelor  *float64
	MonthlyPaymentMaster    *float64
	MonthlyPaymentDoctorate *float64
	YearlyPaymentBachelor   *float64
	YearlyPaymentMaster     *float64
	YearlyPaymentDoctorate  *float64
	BuiltYear               *time.Time
	CommissionedYear        *time.Time
	OwnershipForm           *string
	// ClosedForApplications hides this dormitory from the student-facing
	// browse/apply list and blocks new applications to it, without
	// affecting existing residents, applications, or admin management.
	ClosedForApplications bool
	CreatedBy             uuid.UUID
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

// DormitoryCapacity reports how many beds have been allocated across a
// dormitory's rooms versus its declared total_capacity, alongside the
// declared total_rooms_target versus how many rooms actually exist yet
// (the "256/32" progress figure from the spec, for both dimensions).
type DormitoryCapacity struct {
	DormitoryID      uuid.UUID
	TotalCapacity    int
	AllocatedBeds    int
	TotalRoomsTarget *int
	RoomsCreated     int
}

type DormitoryImage struct {
	ID          uuid.UUID
	DormitoryID uuid.UUID
	ImageURL    string
	CreatedAt   time.Time
}

// DormitoryRequiredDocument links a dormitory to one entry in the shared
// RequiredDocument catalog — a document every applicant to this dormitory
// must upload (e.g. a fluorography certificate), independent of any
// benefit-specific required documents. DocumentName is denormalized (joined
// in) purely for convenient display — the catalog entry (DocumentID) is the
// source of truth.
type DormitoryRequiredDocument struct {
	ID           uuid.UUID
	DormitoryID  uuid.UUID
	DocumentID   uuid.UUID
	DocumentName string
	CreatedAt    time.Time
}
