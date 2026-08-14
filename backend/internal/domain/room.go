package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// RoomRestrictions is the typed shape stored in rooms.restrictions (JSONB).
// Every field is optional: a nil/empty field means "no restriction on this dimension".
type RoomRestrictions struct {
	Gender     *Gender     `json:"gender,omitempty"`
	Courses    []int16     `json:"courses"`
	BenefitIDs []uuid.UUID `json:"benefit_ids"`
}

func (r RoomRestrictions) IsEmpty() bool {
	return r.Gender == nil && len(r.Courses) == 0 && len(r.BenefitIDs) == 0
}

// MarshalJSON normalizes nil Courses/BenefitIDs to empty slices so they
// always serialize as `[]`, never `null` or an omitted key — both the
// rooms.restrictions JSONB column and the API response reuse this same
// marshaling, and the frontend's RoomRestrictions type treats courses/
// benefit_ids as always-present arrays (e.g. `restrictions.courses.length`),
// which crashes if either comes back null/missing (e.g. for a freshly
// created room whose restrictions were never explicitly set).
func (r RoomRestrictions) MarshalJSON() ([]byte, error) {
	courses := r.Courses
	if courses == nil {
		courses = []int16{}
	}
	benefitIDs := r.BenefitIDs
	if benefitIDs == nil {
		benefitIDs = []uuid.UUID{}
	}
	type alias struct {
		Gender     *Gender     `json:"gender,omitempty"`
		Courses    []int16     `json:"courses"`
		BenefitIDs []uuid.UUID `json:"benefit_ids"`
	}
	return json.Marshal(alias{Gender: r.Gender, Courses: courses, BenefitIDs: benefitIDs})
}

type Room struct {
	ID           uuid.UUID
	DormitoryID  uuid.UUID
	RoomNumber   string
	Capacity     int
	Floor        *int
	Category     string
	Restrictions RoomRestrictions
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// NotificationRoomResidentReleased/Transferred back the two manager-initiated
// room actions on RoomService (release, transfer) — distinct from
// NotificationExitRequestUpdate/NotificationTransferRequestUpdate, which are
// tied to the student-initiated request/approval workflows, not a direct
// admin action.
const NotificationRoomResidentReleased NotificationType = "room_resident_released"
const NotificationRoomResidentTransferred NotificationType = "room_resident_transferred"

// RoomResident represents one stay of a student in a room. MovedOutAt is nil
// while the student currently lives there.
type RoomResident struct {
	ID         uuid.UUID
	RoomID     uuid.UUID
	StudentID  uuid.UUID
	MovedInAt  time.Time
	MovedOutAt *time.Time
}
