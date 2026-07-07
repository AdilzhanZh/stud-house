package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

const droppedApplicationComment = "Комиссия мақұлдамағаннан кейін менеджер алып тастады"

type ReportService struct {
	reportTemplates repository.ReportTemplateRepository
	reports         repository.ReportRepository
	applications    repository.ApplicationRepository
	users           repository.UserRepository
	notifier        *notifier.Notifier
	// onApproved is an optional phase-4 hook (contract auto-generation),
	// wired via SetOnApproved. Vote() calls it right after a report becomes
	// approved; nil means no-op, so existing (phase 3) behavior is
	// unchanged when nothing sets it.
	onApproved func(ctx context.Context, reportID uuid.UUID) error
}

// SetOnApproved registers a callback invoked once a report's vote tally
// resolves to ReportApproved. Errors are logged, not returned to the caller
// of Vote — the report decision itself has already committed successfully.
func (s *ReportService) SetOnApproved(fn func(ctx context.Context, reportID uuid.UUID) error) {
	s.onApproved = fn
}

func NewReportService(
	reportTemplates repository.ReportTemplateRepository,
	reports repository.ReportRepository,
	applications repository.ApplicationRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
) *ReportService {
	return &ReportService{
		reportTemplates: reportTemplates,
		reports:         reports,
		applications:    applications,
		users:           users,
		notifier:        notifier,
	}
}

func (s *ReportService) CreateTemplate(ctx context.Context, actorID uuid.UUID, name, fileURL string) (*domain.ReportTemplate, error) {
	if name == "" || fileURL == "" {
		return nil, apperror.BadRequest("name and file_url are required")
	}
	t := &domain.ReportTemplate{Name: name, FileURL: fileURL, CreatedBy: actorID}
	if err := s.reportTemplates.Create(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *ReportService) ListTemplates(ctx context.Context) ([]*domain.ReportTemplate, error) {
	return s.reportTemplates.List(ctx)
}

func (s *ReportService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Report, error) {
	report, err := s.reports.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("report not found")
		}
		return nil, err
	}
	return report, nil
}

func (s *ReportService) List(ctx context.Context, status *domain.ReportStatus) ([]*domain.Report, error) {
	return s.reports.List(ctx, status)
}

// activeCommitteeMemberIDs fetches the current committee_member roster; a
// report cannot be sent to committee if there is no one to review it.
func (s *ReportService) activeCommitteeMemberIDs(ctx context.Context) ([]uuid.UUID, error) {
	members, err := s.users.ListByRole(ctx, domain.RoleCommitteeMember)
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, apperror.BadRequest("no committee members exist to review this report")
	}
	ids := make([]uuid.UUID, len(members))
	for i, m := range members {
		ids[i] = m.ID
	}
	return ids, nil
}

func mapReportCreationError(err error) error {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		return apperror.BadRequest("one or more application_ids do not exist")
	case errors.Is(err, repository.ErrApplicationNotApproved):
		return apperror.BadRequest("all applications must have status=approved")
	case errors.Is(err, repository.ErrConflict):
		return apperror.Conflict("one or more applications are already part of another pending report")
	default:
		return err
	}
}

// CreateReport bundles applicationIDs (all must be status=approved and not
// already in another pending_committee report) into a new report and sends
// it to every current committee_member for review.
func (s *ReportService) CreateReport(ctx context.Context, actorID, templateID uuid.UUID, applicationIDs []uuid.UUID) (*domain.Report, error) {
	if len(applicationIDs) == 0 {
		return nil, apperror.BadRequest("application_ids is required")
	}
	if _, err := s.reportTemplates.GetByID(ctx, templateID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("report template not found")
		}
		return nil, err
	}

	committeeMemberIDs, err := s.activeCommitteeMemberIDs(ctx)
	if err != nil {
		return nil, err
	}

	report := &domain.Report{TemplateID: templateID, CreatedBy: actorID, Status: domain.ReportPendingCommittee}
	if err := s.reports.CreateWithApplications(ctx, report, applicationIDs, committeeMemberIDs); err != nil {
		return nil, mapReportCreationError(err)
	}

	s.notifyCommitteeNewReport(ctx, report.ID, committeeMemberIDs)
	return report, nil
}

// Revise is only allowed on a rejected report. Applications from the old
// report that aren't in the new list are individually marked rejected; a
// fresh report is created (chained via PreviousReportID) with a clean vote.
func (s *ReportService) Revise(ctx context.Context, actorID, oldReportID uuid.UUID, newApplicationIDs []uuid.UUID) (*domain.Report, error) {
	if len(newApplicationIDs) == 0 {
		return nil, apperror.BadRequest("application_ids is required")
	}

	oldReport, err := s.GetByID(ctx, oldReportID)
	if err != nil {
		return nil, err
	}
	if oldReport.Status != domain.ReportRejected {
		return nil, apperror.BadRequest("only a rejected report can be revised")
	}

	oldAppIDs, err := s.reports.ListApplicationIDs(ctx, oldReportID)
	if err != nil {
		return nil, err
	}
	newSet := make(map[uuid.UUID]bool, len(newApplicationIDs))
	for _, id := range newApplicationIDs {
		newSet[id] = true
	}
	var dropped []uuid.UUID
	for _, id := range oldAppIDs {
		if !newSet[id] {
			dropped = append(dropped, id)
		}
	}

	committeeMemberIDs, err := s.activeCommitteeMemberIDs(ctx)
	if err != nil {
		return nil, err
	}

	newReport := &domain.Report{
		TemplateID:       oldReport.TemplateID,
		CreatedBy:        actorID,
		Status:           domain.ReportPendingCommittee,
		PreviousReportID: &oldReportID,
	}

	if err := s.reports.Revise(ctx, oldReportID, newReport, newApplicationIDs, dropped, droppedApplicationComment, actorID, committeeMemberIDs); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("report is not rejected, or an application is already part of another pending report")
		}
		return nil, mapReportCreationError(err)
	}

	s.notifyCommitteeNewReport(ctx, newReport.ID, committeeMemberIDs)
	return newReport, nil
}

func allVotesCast(votes []*domain.CommitteeVote) bool {
	for _, v := range votes {
		if v.Decision == nil {
			return false
		}
	}
	return true
}

func allVotesApproved(votes []*domain.CommitteeVote) bool {
	for _, v := range votes {
		if v.Decision == nil || *v.Decision != domain.VoteApproved {
			return false
		}
	}
	return true
}

// Vote records one committee member's decision. Approval requires every
// member to vote 'approved' (unanimous); once every member has voted, the
// report becomes 'approved' if unanimous, otherwise 'rejected'. Evaluated
// under a row lock so concurrent votes on the same report serialize.
func (s *ReportService) Vote(ctx context.Context, actorID, reportID uuid.UUID, decision domain.VoteDecision, reason *string) (*domain.Report, error) {
	if !decision.Valid() {
		return nil, apperror.BadRequest("invalid decision")
	}
	if decision == domain.VoteRejected && (reason == nil || *reason == "") {
		return nil, apperror.BadRequest("reason is required to reject")
	}

	var decided bool

	err := s.reports.WithVoteLock(ctx, reportID, func(ctx context.Context, report *domain.Report, tx repository.ReportTx) error {
		if report.Status != domain.ReportPendingCommittee {
			return apperror.Conflict("report is no longer pending committee review")
		}
		if _, err := tx.GetVote(ctx, reportID, actorID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return apperror.Forbidden("you are not a committee member on this report")
			}
			return err
		}
		if err := tx.SetVote(ctx, reportID, actorID, decision, reason); err != nil {
			return err
		}

		votes, err := tx.ListVotes(ctx, reportID)
		if err != nil {
			return err
		}
		if !allVotesCast(votes) {
			return nil
		}

		finalStatus := domain.ReportRejected
		if allVotesApproved(votes) {
			finalStatus = domain.ReportApproved
		}
		decided = true
		return tx.SetReportStatus(ctx, reportID, finalStatus)
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, reportID)
	if err != nil {
		return nil, err
	}
	if decided {
		s.notifyReportDecision(ctx, updated)
		if updated.Status == domain.ReportApproved && s.onApproved != nil {
			if err := s.onApproved(ctx, updated.ID); err != nil {
				log.Printf("report %s approved but onApproved hook failed: %v", updated.ID, err)
			}
		}
	}
	return updated, nil
}

func (s *ReportService) notifyCommitteeNewReport(ctx context.Context, reportID uuid.UUID, committeeMemberIDs []uuid.UUID) {
	body := fmt.Sprintf("Жаңа рапорт (ID: %s) сіздің қарауыңызды күтуде.", reportID)
	for _, memberID := range committeeMemberIDs {
		_ = s.notifier.Notify(ctx, memberID, domain.NotificationReportReview, "Жаңа рапорт қарауға жіберілді", body, nil)
	}
}

func (s *ReportService) notifyReportDecision(ctx context.Context, report *domain.Report) {
	title, body := "Рапорт мақұлданды", fmt.Sprintf("Рапорт (ID: %s) комиссия тарапынан мақұлданды.", report.ID)
	if report.Status == domain.ReportRejected {
		title, body = "Рапорт қабылданбады", fmt.Sprintf("Рапорт (ID: %s) комиссия тарапынан қабылданбады.", report.ID)
	}
	_ = s.notifier.Notify(ctx, report.CreatedBy, domain.NotificationReportReview, title, body, nil)
}

// ReportDetail bundles a report with everything needed to render it: the
// template, each application + its student, and the committee vote roster.
type ReportDetail struct {
	Report           *domain.Report
	Template         *domain.ReportTemplate
	Applications     []*domain.Application
	Students         map[uuid.UUID]*domain.User
	Votes            []*domain.CommitteeVote
	CommitteeMembers map[uuid.UUID]*domain.User
}

func (s *ReportService) GetDetail(ctx context.Context, reportID uuid.UUID) (*ReportDetail, error) {
	report, err := s.GetByID(ctx, reportID)
	if err != nil {
		return nil, err
	}

	template, err := s.reportTemplates.GetByID(ctx, report.TemplateID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("report template not found")
		}
		return nil, err
	}

	appIDs, err := s.reports.ListApplicationIDs(ctx, reportID)
	if err != nil {
		return nil, err
	}

	applications := make([]*domain.Application, 0, len(appIDs))
	students := make(map[uuid.UUID]*domain.User)
	for _, id := range appIDs {
		app, err := s.applications.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				continue
			}
			return nil, err
		}
		applications = append(applications, app)
		if _, ok := students[app.StudentID]; !ok {
			student, err := s.users.GetByID(ctx, app.StudentID)
			if err != nil {
				return nil, err
			}
			students[app.StudentID] = student
		}
	}

	votes, err := s.reports.ListVotes(ctx, reportID)
	if err != nil {
		return nil, err
	}
	committeeMembers := make(map[uuid.UUID]*domain.User)
	for _, v := range votes {
		if _, ok := committeeMembers[v.CommitteeMemberID]; !ok {
			member, err := s.users.GetByID(ctx, v.CommitteeMemberID)
			if err != nil {
				return nil, err
			}
			committeeMembers[v.CommitteeMemberID] = member
		}
	}

	return &ReportDetail{
		Report:           report,
		Template:         template,
		Applications:     applications,
		Students:         students,
		Votes:            votes,
		CommitteeMembers: committeeMembers,
	}, nil
}
