package domain

import (
	"time"

	"github.com/google/uuid"
)

// ReportTemplate is a manager-uploaded template file. Filling it in with
// student data (placeholder substitution into an actual document) is out of
// scope this phase; only the template's own metadata + file_url are stored.
type ReportTemplate struct {
	ID        uuid.UUID
	Name      string
	FileURL   string
	CreatedBy uuid.UUID
	CreatedAt time.Time
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

// CommitteeVote is created with Decision == nil for every committee_member
// as soon as a report is sent for review; it is filled in once that member
// votes. Approval requires every vote to end up VoteApproved (unanimous);
// see ReportService.tallyVotes.
type CommitteeVote struct {
	ID                uuid.UUID
	ReportID          uuid.UUID
	CommitteeMemberID uuid.UUID
	Decision          *VoteDecision
	Reason            *string
	VotedAt           *time.Time
}
