package domain

import (
	"time"

	"github.com/google/uuid"
)

// RequiredDocument is a shared, reusable document catalog entry (e.g. "3х4
// фото"), picked by name once and then attached to any number of benefits
// and/or dormitories via BenefitRequiredDocument/DormitoryRequiredDocument,
// instead of every benefit/dormitory re-typing the same document name.
type RequiredDocument struct {
	ID        uuid.UUID
	Name      string
	CreatedAt time.Time
}
