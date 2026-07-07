package domain

import (
	"time"

	"github.com/google/uuid"
)

type ApplicationStatus string

const (
	ApplicationPending         ApplicationStatus = "pending"
	ApplicationManagerReview   ApplicationStatus = "manager_review"
	ApplicationNeedsCorrection ApplicationStatus = "needs_correction"
	ApplicationApproved        ApplicationStatus = "approved"
	ApplicationRejected        ApplicationStatus = "rejected"
)

func (s ApplicationStatus) Valid() bool {
	switch s {
	case ApplicationPending, ApplicationManagerReview, ApplicationNeedsCorrection, ApplicationApproved, ApplicationRejected:
		return true
	default:
		return false
	}
}

// Application is a student's request for a place in a dormitory. Its status
// only ever visibly rests at pending / needs_correction / approved / rejected;
// manager_review is a transient sub-state recorded in the history but never
// persisted as the application's resting status (see ApplicationService.Decide).
type Application struct {
	ID                uuid.UUID
	StudentID         uuid.UUID
	DormitoryID       uuid.UUID
	Status            ApplicationStatus
	PreferredRoomType *string
	Notes             *string
	AssignedRoomID    *uuid.UUID
	HandledBy         *uuid.UUID
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// ApplicationStatusHistory is an immutable audit log entry for one status
// transition. FromStatus is nil for the very first entry (application creation).
type ApplicationStatusHistory struct {
	ID            uuid.UUID
	ApplicationID uuid.UUID
	FromStatus    *ApplicationStatus
	ToStatus      ApplicationStatus
	Comment       *string
	ChangedBy     uuid.UUID
	CreatedAt     time.Time
}
