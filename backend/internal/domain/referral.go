package domain

import (
	"time"

	"github.com/google/uuid"
)

// NotificationReferralIssued is a notification_type enum value (added by a
// dedicated migration) telling a student their referral is ready.
const NotificationReferralIssued NotificationType = "referral_issued"

// MaxInstituteLength caps the free-text institute a student enters.
const MaxInstituteLength = 200

// Referral is the document ("Жолдама") a student shows at their dormitory. Its
// QR code opens the page for Token, which replaces the paper form's stamp.
//
// Valid is worked out on every read rather than stored: the student must live
// in a room now, and this must be their latest referral. DormitoryName,
// DormitoryAddress, RoomNumber and Institute are read live too, so they're
// empty for a student who isn't placed or hasn't entered an institute.
type Referral struct {
	ID               uuid.UUID
	Number           int
	Token            string
	StudentID        uuid.UUID
	ProtocolNumber   int
	StudyGroup       string
	SignatoryName    string
	IssuedAt         time.Time
	StudentFullName  string
	Institute        string
	DormitoryName    string
	DormitoryAddress string
	RoomNumber       string
	Valid            bool
}
