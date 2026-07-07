package domain

import (
	"time"

	"github.com/google/uuid"
)

// RoomRestrictions is the typed shape stored in rooms.restrictions (JSONB).
// Every field is optional: a nil/empty field means "no restriction on this dimension".
type RoomRestrictions struct {
	Gender     *Gender     `json:"gender,omitempty"`
	Courses    []int16     `json:"courses,omitempty"`
	BenefitIDs []uuid.UUID `json:"benefit_ids,omitempty"`
}

func (r RoomRestrictions) IsEmpty() bool {
	return r.Gender == nil && len(r.Courses) == 0 && len(r.BenefitIDs) == 0
}

type Room struct {
	ID           uuid.UUID
	DormitoryID  uuid.UUID
	RoomNumber   string
	Capacity     int
	Restrictions RoomRestrictions
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// RoomResident represents one stay of a student in a room. MovedOutAt is nil
// while the student currently lives there.
type RoomResident struct {
	ID         uuid.UUID
	RoomID     uuid.UUID
	StudentID  uuid.UUID
	MovedInAt  time.Time
	MovedOutAt *time.Time
}
