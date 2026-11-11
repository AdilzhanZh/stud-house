package domain

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// RoomRestrictions is the typed shape stored in rooms.restrictions (JSONB).
// Every field is optional: a nil/empty field means "no restriction on this dimension".
type RoomRestrictions struct {
	Gender     *Gender          `json:"gender,omitempty"`
	Courses    []int16          `json:"courses"`
	Degrees    []AcademicDegree `json:"degrees"`
	BenefitIDs []uuid.UUID      `json:"benefit_ids"`
}

func (r RoomRestrictions) IsEmpty() bool {
	return r.Gender == nil && len(r.Courses) == 0 && len(r.Degrees) == 0 && len(r.BenefitIDs) == 0
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
	degrees := r.Degrees
	if degrees == nil {
		degrees = []AcademicDegree{}
	}
	benefitIDs := r.BenefitIDs
	if benefitIDs == nil {
		benefitIDs = []uuid.UUID{}
	}
	type alias struct {
		Gender     *Gender          `json:"gender,omitempty"`
		Courses    []int16          `json:"courses"`
		Degrees    []AcademicDegree `json:"degrees"`
		BenefitIDs []uuid.UUID      `json:"benefit_ids"`
	}
	return json.Marshal(alias{Gender: r.Gender, Courses: courses, Degrees: degrees, BenefitIDs: benefitIDs})
}

// Room sits on a floor of a dormitory building. FloorID is the source of
// truth: DormitoryID and Floor (the floor's number) are kept in sync with
// it by the database (trigger rooms_sync_location). FloorName is read-only,
// filled in by queries.
type Room struct {
	ID           uuid.UUID
	DormitoryID  uuid.UUID
	FloorID      uuid.UUID
	FloorName    *string
	RoomNumber   string
	Capacity     int
	Floor        *int
	Category     string
	Restrictions RoomRestrictions
	// Optional descriptive fields (nil / empty = not filled in).
	AreaSqM            *float64
	Equipment          *string
	SanitaryConditions *string
	IsAccessible       *bool
	AccessibilityNotes *string
	PhotoURLs          []string
	CreatedAt          time.Time
	UpdatedAt          time.Time
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
//
// BedID is the bed place the stay is on. It is nil only for stays that had
// already ended before beds existed (migration 000098). BedLabel and
// BedInventoryNo are read-only copies of that bed's fields, filled in by
// queries that join beds.
type RoomResident struct {
	ID             uuid.UUID
	RoomID         uuid.UUID
	StudentID      uuid.UUID
	BedID          *uuid.UUID
	BedLabel       *string
	BedInventoryNo *int64
	MovedInAt      time.Time
	MovedOutAt     *time.Time
}

// Bed is one bed place (койко-место) in a room. ID and InventoryNo are
// permanent: a bed place is never deleted or renumbered, only retired
// (RetiredAt set) when the dormitory physically removes the bed. A
// relocation only changes which bed a stay points to. Label is the
// editable position inside the room.
//
// ResidentID/StudentID describe the current stay on this bed, nil when free.
// HeldApplicationID/HeldStudentID describe the active application holding
// it, nil when none. Service* is the out-of-service mark a manager sets by
// hand (see BedServiceStatus); Status combines all of these.
type Bed struct {
	ID                uuid.UUID
	InventoryNo       int64
	RoomID            uuid.UUID
	Label             string
	CreatedAt         time.Time
	RetiredAt         *time.Time
	ResidentID        *uuid.UUID
	StudentID         *uuid.UUID
	HeldApplicationID *uuid.UUID
	HeldStudentID     *uuid.UUID
	ServiceStatus     BedServiceStatus
	ServiceReason     *string
	ServiceUntil      *time.Time
	ServiceChangedAt  *time.Time
	ServiceChangedBy  *uuid.UUID
}

// BedServiceStatus is the part of a bed's status a manager sets by hand
// (beds.service_status). Everything else about a bed's status is worked
// out from its stay and hold.
type BedServiceStatus string

const (
	BedInService   BedServiceStatus = "in_service"
	BedRepair      BedServiceStatus = "repair"      // на ремонте
	BedUnavailable BedServiceStatus = "unavailable" // временно недоступно
)

func (s BedServiceStatus) Valid() bool {
	return s == BedInService || s == BedRepair || s == BedUnavailable
}

// BedStatus is what a bed place is shown as.
type BedStatus string

const (
	BedStatusFree        BedStatus = "free"        // свободно
	BedStatusReserved    BedStatus = "reserved"    // забронировано
	BedStatusOccupied    BedStatus = "occupied"    // занято
	BedStatusRepair      BedStatus = "repair"      // на ремонте
	BedStatusUnavailable BedStatus = "unavailable" // временно недоступно
)

// Status works out the bed's status. The database keeps occupied/reserved
// beds in service, so at most one of these applies; the order only makes
// the answer defined for any input.
func (b *Bed) Status() BedStatus {
	switch {
	case b.ResidentID != nil:
		return BedStatusOccupied
	case b.HeldApplicationID != nil:
		return BedStatusReserved
	case b.ServiceStatus == BedRepair:
		return BedStatusRepair
	case b.ServiceStatus == BedUnavailable:
		return BedStatusUnavailable
	}
	return BedStatusFree
}

// BedStatusChange is one entry of a bed's service-status history.
type BedStatusChange struct {
	ID        uuid.UUID
	BedID     uuid.UUID
	OldStatus BedServiceStatus
	NewStatus BedServiceStatus
	Reason    *string
	Until     *time.Time
	ChangedBy *uuid.UUID
	ChangedAt time.Time
}

// BedCode formats a bed's permanent inventory number the way people see
// it, e.g. 412 -> "B-000412".
func BedCode(inventoryNo int64) string {
	return fmt.Sprintf("B-%06d", inventoryNo)
}

// RoomAvailability is a Room plus how many seats are already spoken for —
// by actual residents (ResidentCount) and by pending applicants who have
// this room as their current pick, i.e. a "hold" (HeldCount; see
// RoomService.CheckHoldable). OutOfServiceCount is the beds under repair or
// temporarily unavailable. Capacity - OutOfServiceCount - ResidentCount -
// HeldCount is how many more applicants may still pick this room.
type RoomAvailability struct {
	*Room
	ResidentCount     int
	HeldCount         int
	OutOfServiceCount int
}
