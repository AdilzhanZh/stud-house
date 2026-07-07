package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// ErrApplicationNotApproved is returned when a report is created/revised
// with an application whose status isn't 'approved'.
var ErrApplicationNotApproved = errors.New("application is not approved")

type ReportTemplateRepository interface {
	Create(ctx context.Context, t *domain.ReportTemplate) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.ReportTemplate, error)
	List(ctx context.Context) ([]*domain.ReportTemplate, error)
}

// ReportTx exposes the writes that must happen atomically together with the
// row lock acquired by ReportRepository.WithVoteLock.
type ReportTx interface {
	GetVote(ctx context.Context, reportID, committeeMemberID uuid.UUID) (*domain.CommitteeVote, error)
	SetVote(ctx context.Context, reportID, committeeMemberID uuid.UUID, decision domain.VoteDecision, reason *string) error
	ListVotes(ctx context.Context, reportID uuid.UUID) ([]*domain.CommitteeVote, error)
	SetReportStatus(ctx context.Context, reportID uuid.UUID, status domain.ReportStatus) error
}

type ReportRepository interface {
	// CreateWithApplications locks and validates applicationIDs (must all be
	// approved and not already attached to another pending_committee report),
	// then atomically creates the report, its report_applications rows, and
	// one NULL-decision committee_votes row per committeeMemberIDs.
	// Returns ErrNotFound if an id doesn't exist, ErrApplicationNotApproved,
	// or ErrConflict if one is already in a pending report.
	CreateWithApplications(ctx context.Context, report *domain.Report, applicationIDs []uuid.UUID, committeeMemberIDs []uuid.UUID) error

	GetByID(ctx context.Context, id uuid.UUID) (*domain.Report, error)
	List(ctx context.Context, status *domain.ReportStatus) ([]*domain.Report, error)
	ListApplicationIDs(ctx context.Context, reportID uuid.UUID) ([]uuid.UUID, error)
	ListVotes(ctx context.Context, reportID uuid.UUID) ([]*domain.CommitteeVote, error)

	// WithVoteLock locks the report row (SELECT ... FOR UPDATE) for the
	// duration of fn, so a vote submission and the resulting tally check are
	// atomic against concurrent votes on the same report.
	WithVoteLock(ctx context.Context, reportID uuid.UUID, fn func(ctx context.Context, report *domain.Report, tx ReportTx) error) error

	// Revise locks the old (rejected) report, marks droppedApplicationIDs as
	// rejected applications (with a history entry using droppedComment), and
	// atomically creates newReport (whose PreviousReportID must already be
	// set to the old report's id) the same way CreateWithApplications does.
	Revise(ctx context.Context, oldReportID uuid.UUID, newReport *domain.Report, newApplicationIDs, droppedApplicationIDs []uuid.UUID, droppedComment string, changedBy uuid.UUID, committeeMemberIDs []uuid.UUID) error
}
