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

// ReferralTemplate is the editable wording of every referral, a singleton like
// ProtocolTemplate. The university band, QR code and verification note aren't
// part of it: they are added around it, so that no edit can remove them.
type ReferralTemplate struct {
	ID        uuid.UUID
	Pages     []string
	UpdatedBy uuid.UUID
	UpdatedAt time.Time
}

// ReferralVariable is a token a manager can insert into the template. Required
// ones identify the student and the place, and a referral proves nothing
// without them, so the template can't be saved with one missing.
type ReferralVariable struct {
	Token    string
	Label    string
	Required bool
}

var ReferralVariables = []ReferralVariable{
	{Token: "{{referral_number}}", Label: "Жолдама нөмірі", Required: true},
	{Token: "{{student_full_name}}", Label: "Студенттің аты-жөні", Required: true},
	{Token: "{{dormitory_name}}", Label: "Жатақхана", Required: true},
	{Token: "{{room_number}}", Label: "Бөлме нөмірі", Required: true},
	{Token: "{{institute}}", Label: "Институт"},
	{Token: "{{study_group}}", Label: "Оқу тобы"},
	{Token: "{{dormitory_address}}", Label: "Жатақхана мекен-жайы"},
	{Token: "{{protocol_number}}", Label: "Хаттама нөмірі"},
	{Token: "{{signatory_name}}", Label: "Проректордың аты-жөні"},
	{Token: "{{issue_date}}", Label: "Берілген күні"},
}
