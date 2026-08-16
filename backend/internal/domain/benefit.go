package domain

import (
	"time"

	"github.com/google/uuid"
)

type Benefit struct {
	ID            uuid.UUID
	NameKk        string
	NameRu        string
	DescriptionKk string
	DescriptionRu string
	// Priority is a 1-10 weight (10 = highest) admins assign when comparing
	// applicants with different benefits — purely a stored weight this
	// phase, not yet consumed by any ranking logic.
	Priority  int
	CreatedBy uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
}

// BenefitRequiredDocument links a benefit to one entry in the shared
// RequiredDocument catalog. DocumentName{Kk,Ru} is denormalized (joined in)
// purely for convenient display — the catalog entry (DocumentID) is the
// source of truth.
type BenefitRequiredDocument struct {
	ID             uuid.UUID
	BenefitID      uuid.UUID
	DocumentID     uuid.UUID
	DocumentNameKk string
	DocumentNameRu string
	CreatedAt      time.Time
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
