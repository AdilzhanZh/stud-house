package domain

import (
	"time"

	"github.com/google/uuid"
)

// ProtocolStatus rests at exactly two values on purpose: a manager only
// needs to know "still needs sign-off" vs "fully approved" at a glance (the
// protocol list); the granular per-member breakdown (approved / rejected /
// not yet decided) only matters on the detail page — see
// ProtocolService.GetDetail and CommitteeVote.
type ProtocolStatus string

const (
	ProtocolPending  ProtocolStatus = "pending"
	ProtocolApproved ProtocolStatus = "approved"
)

func (s ProtocolStatus) Valid() bool {
	switch s {
	case ProtocolPending, ProtocolApproved:
		return true
	default:
		return false
	}
}

// ProtocolTemplate is the single, manager/admin-editable document used to
// generate each prepared protocol's printable "Хаттама" — same pattern as
// PetitionTemplate, a singleton edited in place via a WYSIWYG editor rather
// than a family of selectable templates. Pages is an ordered list of HTML
// fragments — almost always just one page, but a manager can add more
// through the editor if the wording grows past one sheet.
type ProtocolTemplate struct {
	ID        uuid.UUID
	Pages     []string
	UpdatedBy uuid.UUID
	UpdatedAt time.Time
}

// Protocol is a committee meeting-minutes document ("Хаттама") bundling a
// batch of approved applications for placement, sent to every current
// committee member for a vote. Number is a manager-facing sequential id
// (Postgres SERIAL) matching the "№___" blank on the paper template — never
// reused even if a protocol is later deleted.
type Protocol struct {
	ID        uuid.UUID
	Number    int
	Status    ProtocolStatus
	CreatedBy uuid.UUID
	CreatedAt time.Time
	UpdatedAt time.Time
}

// NotificationProtocolReview is a notification_type enum value (added by a
// dedicated migration) for protocol-review notifications sent to committee
// members and the protocol's creator.
const NotificationProtocolReview NotificationType = "protocol_review"

type VoteDecision string

const (
	VoteApproved VoteDecision = "approved"
	VoteRejected VoteDecision = "rejected"
)

func (d VoteDecision) Valid() bool {
	switch d {
	case VoteApproved, VoteRejected:
		return true
	default:
		return false
	}
}

// CommitteeVote is created with Decision == nil for every committee member
// (is_committee_member = true) as soon as a protocol is prepared; it is
// filled in once that member votes. A protocol becomes ProtocolApproved
// only once every member has voted VoteApproved (unanimous) — see
// ProtocolService.Vote.
type CommitteeVote struct {
	ID                uuid.UUID
	ProtocolID        uuid.UUID
	CommitteeMemberID uuid.UUID
	Decision          *VoteDecision
	Reason            *string
	VotedAt           *time.Time
}

// ProtocolVariable is one of the fixed set of tokens a manager can insert
// into the protocol template via the editor UI. StudentList is special: at
// generation time it expands into one numbered line per selected student,
// not a single value — see the frontend's fillProtocolTemplate.
type ProtocolVariable struct {
	Token string
	Label string
}

var ProtocolVariables = []ProtocolVariable{
	{Token: "{{protocol_number}}", Label: "Хаттама нөмірі"},
	{Token: "{{protocol_date}}", Label: "Хаттама күні"},
	{Token: "{{student_list}}", Label: "Студенттер тізімі"},
}
