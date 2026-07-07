package domain

import (
	"time"

	"github.com/google/uuid"
)

type Benefit struct {
	ID          uuid.UUID
	Name        string
	Description string
	CreatedBy   uuid.UUID
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type BenefitField struct {
	ID        uuid.UUID
	BenefitID uuid.UUID
	FieldName string
	FieldType string
	CreatedAt time.Time
}

type BenefitRequiredDocument struct {
	ID           uuid.UUID
	BenefitID    uuid.UUID
	DocumentName string
	CreatedAt    time.Time
}

// StudentBenefit is a minimal "student X has benefit Y" assignment record,
// used by room restriction validation. It is not the full benefit
// application/approval workflow, which is out of scope for this phase.
type StudentBenefit struct {
	ID         uuid.UUID
	StudentID  uuid.UUID
	BenefitID  uuid.UUID
	AssignedBy uuid.UUID
	AssignedAt time.Time
}
