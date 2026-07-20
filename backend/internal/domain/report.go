package domain

import (
	"time"

	"github.com/google/uuid"
)

// ReportTemplate is a manager-authored, structured report definition: an
// optional intro paragraph plus a chosen subset of StudentColumns that
// controls both the on-screen summary and the PDF export layout. FileURL is
// an optional legacy/attached document — no longer required by the in-app
// builder, but still honored by ContractService.OnReportApproved as the
// student-facing contract "Open PDF" link when a manager attaches one.
type ReportTemplate struct {
	ID             uuid.UUID
	Name           string
	IntroText      string
	StudentColumns []string
	FileURL        *string
	CreatedBy      uuid.UUID
	CreatedAt      time.Time
}

// ReportStudentColumn enumerates the student-data fields a template can
// choose to display in the generated report table.
type ReportStudentColumn string

const (
	ReportColumnFullName      ReportStudentColumn = "full_name"
	ReportColumnEmail         ReportStudentColumn = "email"
	ReportColumnPhone         ReportStudentColumn = "phone"
	ReportColumnDormitoryName ReportStudentColumn = "dormitory_name"
	ReportColumnRoomNumber    ReportStudentColumn = "room_number"
)

func (c ReportStudentColumn) Valid() bool {
	switch c {
	case ReportColumnFullName, ReportColumnEmail, ReportColumnPhone, ReportColumnDormitoryName, ReportColumnRoomNumber:
		return true
	default:
		return false
	}
}

type ReportStatus string

const (
	ReportPendingCommittee ReportStatus = "pending_committee"
	ReportApproved         ReportStatus = "approved"
	ReportRejected         ReportStatus = "rejected"
)

func (s ReportStatus) Valid() bool {
	switch s {
	case ReportPendingCommittee, ReportApproved, ReportRejected:
		return true
	default:
		return false
	}
}

// Report bundles a batch of approved applications for committee review.
// PreviousReportID chains a resubmitted report back to the rejected one it
// revises; a decided report (approved/rejected) is never mutated again.
type Report struct {
	ID               uuid.UUID
	TemplateID       uuid.UUID
	CreatedBy        uuid.UUID
	Status           ReportStatus
	PreviousReportID *uuid.UUID
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// NotificationReportReview is a new notification_type enum value (added by a
// dedicated migration) used for report-review notifications — it doesn't
// fit NotificationApplicationStatusChanged/NotificationDocumentRequested
// (phase 2) since it concerns a report, not a single application.
const NotificationReportReview NotificationType = "report_review"

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
// (is_committee_member = true) as soon as a report is sent for review; it
// is filled in once that member votes. Approval requires every vote to end
// up VoteApproved (unanimous); see ReportService.tallyVotes.
type CommitteeVote struct {
	ID                uuid.UUID
	ReportID          uuid.UUID
	CommitteeMemberID uuid.UUID
	Decision          *VoteDecision
	Reason            *string
	VotedAt           *time.Time
}
