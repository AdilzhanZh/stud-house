package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// TriageService sorts pending applications into green/yellow/red (see
// domain.TriageColor) and runs the bulk actions that sorting exists for:
// approving every green application at once, and sending every yellow one
// back to its student with a precise list of what to fix.
//
// Triage is computed on read rather than stored: it depends on rows that
// change independently of the application (a dormitory gaining a required
// document, a room filling up, a benefit being assigned), so a stored color
// would go stale without anything touching the application itself.
type TriageService struct {
	applications repository.ApplicationRepository
	documents    repository.ApplicationDocumentRepository
	rooms        *RoomService
	decider      *ApplicationService
	checks       *DocumentCheckService
}

// SetDocumentChecks lets triage know whether AI checks are running: while
// they're switched off, documents still queued for one aren't waited on.
func (s *TriageService) SetDocumentChecks(checks *DocumentCheckService) {
	s.checks = checks
}

func NewTriageService(applications repository.ApplicationRepository, documents repository.ApplicationDocumentRepository, rooms *RoomService, decider *ApplicationService) *TriageService {
	return &TriageService{applications: applications, documents: documents, rooms: rooms, decider: decider}
}

// ListPending triages every pending application.
func (s *TriageService) ListPending(ctx context.Context) ([]*domain.ApplicationTriage, error) {
	pending := domain.ApplicationPending
	apps, err := s.applications.List(ctx, &pending)
	if err != nil {
		return nil, err
	}
	return s.triage(ctx, apps)
}

func (s *TriageService) triage(ctx context.Context, apps []*domain.Application) ([]*domain.ApplicationTriage, error) {
	ids := make([]uuid.UUID, 0, len(apps))
	for _, a := range apps {
		ids = append(ids, a.ID)
	}
	missing, err := s.documents.ListMissingRequired(ctx, ids)
	if err != nil {
		return nil, err
	}
	missingByApp := make(map[uuid.UUID][]*domain.MissingRequiredDocument)
	for _, m := range missing {
		missingByApp[m.ApplicationID] = append(missingByApp[m.ApplicationID], m)
	}
	checks, err := s.documents.ListLatestChecks(ctx, ids)
	if err != nil {
		return nil, err
	}
	checksByApp := make(map[uuid.UUID][]*domain.DocumentCheck)
	for _, c := range checks {
		checksByApp[c.ApplicationID] = append(checksByApp[c.ApplicationID], c)
	}
	today := todayLocal(time.Now())

	out := make([]*domain.ApplicationTriage, 0, len(apps))
	for _, a := range apps {
		t := &domain.ApplicationTriage{ApplicationID: a.ID, Color: domain.TriageGreen}
		for _, m := range missingByApp[a.ID] {
			t.Reasons = append(t.Reasons, domain.TriageReason{
				Code:           domain.TriageMissingDocument,
				DocumentNameKk: m.NameKk,
				DocumentNameRu: m.NameRu,
			})
		}
		for _, c := range checksByApp[a.ID] {
			if c.Status.InProgress() && s.checks.Enabled() {
				t.Checking = true
			}
			t.Reasons = append(t.Reasons, checkReasons(c, today)...)
		}
		if detail, err := s.checkPreferredRoom(ctx, a); err != nil {
			return nil, err
		} else if detail != "" {
			t.Reasons = append(t.Reasons, domain.TriageReason{Code: domain.TriageRoomUnavailable, Detail: detail})
		}
		for _, r := range t.Reasons {
			if r.Code.Red() {
				t.Color = domain.TriageRed
				break
			}
			t.Color = domain.TriageYellow
		}
		out = append(out, t)
	}
	return out, nil
}

func todayLocal(now time.Time) time.Time {
	local := now.In(kyzylorda)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC)
}

// checkReasons turns one document's AI check into triage reasons. A
// document the checker couldn't read or check is never left looking clean:
// otherwise re-uploading an unreadable file over a flagged one would turn
// the application green.
func checkReasons(c *domain.DocumentCheck, today time.Time) []domain.TriageReason {
	reason := func(code domain.TriageReasonCode, detail, detailRu string) domain.TriageReason {
		return domain.TriageReason{Code: code, DocumentNameKk: c.NameKk, DocumentNameRu: c.NameRu, Detail: detail, DetailRu: detailRu}
	}
	switch c.Status {
	case domain.DocumentCheckUnsupported:
		return []domain.TriageReason{reason(domain.TriageUnsupportedFormat, c.Error, "")}
	case domain.DocumentCheckFailed:
		return []domain.TriageReason{reason(domain.TriageCheckFailed, "", "")}
	}
	if c.Status != domain.DocumentCheckDone || c.Result == nil {
		return nil
	}
	r := c.Result
	// An unreadable document can't be judged on anything else.
	if !r.Readable {
		return []domain.TriageReason{reason(domain.TriageDocumentUnreadable, "", "")}
	}
	var out []domain.TriageReason
	if r.ForgerySigns {
		out = append(out, reason(domain.TriageSuspectedForgery, r.ForgeryReasonKk, r.ForgeryReasonRu))
	}
	if r.NamesStudent == domain.NameMatchNo {
		out = append(out, reason(domain.TriageNameMismatch, r.HolderFullName, ""))
	}
	if !r.MatchesExpectedType {
		out = append(out, reason(domain.TriageWrongDocumentType, r.DetectedType, r.DetectedType))
	} else if issued := r.IssuedOn(); issued != nil && c.ValidityDays != nil &&
		issued.AddDate(0, 0, *c.ValidityDays).Before(today) {
		out = append(out, reason(domain.TriageDocumentExpired, r.IssueDate, r.IssueDate))
	}
	return out
}

// StudentFixes lists what the student has to upload (again) for an
// application: missing required documents, plus documents whose AI check
// found something the student can fix (unreadable, wrong document,
// expired). Red findings are for managers only and never listed here.
func (s *TriageService) StudentFixes(ctx context.Context, applicationID uuid.UUID) ([]*domain.MissingRequiredDocument, error) {
	ids := []uuid.UUID{applicationID}
	out, err := s.documents.ListMissingRequired(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, m := range out {
		m.Reason = domain.TriageMissingDocument
	}
	checks, err := s.documents.ListLatestChecks(ctx, ids)
	if err != nil {
		return nil, err
	}
	today := todayLocal(time.Now())
	for _, c := range checks {
		for _, r := range checkReasons(c, today) {
			if r.Code.Red() {
				continue
			}
			out = append(out, &domain.MissingRequiredDocument{
				ApplicationID:               applicationID,
				BenefitRequiredDocumentID:   c.BenefitRequiredDocumentID,
				DormitoryRequiredDocumentID: c.DormitoryRequiredDocumentID,
				NameKk:                      c.NameKk,
				NameRu:                      c.NameRu,
				Reason:                      r.Code,
				Detail:                      r.Detail,
			})
			break // one entry per document is enough to ask for a re-upload
		}
	}
	return out, nil
}

// checkPreferredRoom runs the same room checks ApplicationService.Decide
// runs on approve, so a green application is one that bulk approval won't
// then fail on. It returns the failed check's message, or "" if the room is
// fine (or the student never picked one). Non-AppError failures are real
// errors (DB down etc.) and are returned as such.
func (s *TriageService) checkPreferredRoom(ctx context.Context, a *domain.Application) (string, error) {
	if a.PreferredRoomID == nil {
		return "", nil
	}
	err := func() error {
		if _, err := s.rooms.ValidateAssignable(ctx, *a.PreferredRoomID, a.StudentID); err != nil {
			return err
		}
		return s.rooms.CheckHoldable(ctx, *a.PreferredRoomID, &a.ID)
	}()
	if err == nil {
		return "", nil
	}
	var appErr *apperror.AppError
	if errors.As(err, &appErr) {
		return appErr.Message, nil
	}
	return "", err
}

// BulkResult is the per-application outcome of a bulk action. Error is the
// AppError message when that one application was skipped or failed; the
// rest of the batch still goes ahead.
type BulkResult struct {
	ApplicationID uuid.UUID
	Error         string
}

// ApproveGreen approves the given applications, re-triaging them first so
// an application that stopped being green since the manager's page loaded
// (a room filled up, a required document was added) is skipped rather than
// approved on stale information.
func (s *TriageService) ApproveGreen(ctx context.Context, actorID uuid.UUID, applicationIDs []uuid.UUID) ([]BulkResult, error) {
	return s.bulk(ctx, applicationIDs, domain.TriageGreen, func(t *domain.ApplicationTriage) error {
		_, err := s.decider.Decide(ctx, actorID, t.ApplicationID, ActionApprove, nil, nil)
		return err
	})
}

// RequestCorrections sends each given yellow application back to its
// student (needs_correction), with a comment listing exactly what's missing.
// Decide's request_correction branch notifies the student with that comment.
func (s *TriageService) RequestCorrections(ctx context.Context, actorID uuid.UUID, applicationIDs []uuid.UUID) ([]BulkResult, error) {
	return s.bulk(ctx, applicationIDs, domain.TriageYellow, func(t *domain.ApplicationTriage) error {
		comment := correctionComment(t.Reasons)
		_, err := s.decider.Decide(ctx, actorID, t.ApplicationID, ActionRequestCorrection, nil, &comment)
		return err
	})
}

func (s *TriageService) bulk(ctx context.Context, applicationIDs []uuid.UUID, want domain.TriageColor, act func(*domain.ApplicationTriage) error) ([]BulkResult, error) {
	if len(applicationIDs) == 0 {
		return nil, apperror.BadRequest("өтініштер таңдалмаған")
	}
	current, err := s.ListPending(ctx)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]*domain.ApplicationTriage, len(current))
	for _, t := range current {
		byID[t.ApplicationID] = t
	}

	results := make([]BulkResult, 0, len(applicationIDs))
	for _, id := range applicationIDs {
		r := BulkResult{ApplicationID: id}
		t, ok := byID[id]
		switch {
		case !ok:
			r.Error = "өтініш шешім қабылдауды күтіп тұрған жоқ"
		case t.Color != want:
			r.Error = "өтініштің тексеру нәтижесі өзгерді, оны жеке қараңыз"
		case want == domain.TriageGreen && t.Checking:
			r.Error = "құжаттарды ЖИ тексеруі әлі аяқталмаған"
		default:
			if err := act(t); err != nil {
				var appErr *apperror.AppError
				if !errors.As(err, &appErr) {
					return nil, err
				}
				r.Error = appErr.Message
			}
		}
		results = append(results, r)
	}
	return results, nil
}

// correctionComment reads as the tail of the student's notification
// ("Мына құжатыңыз/деректеріңіз толық емес: <comment>", see
// decisionNotificationText), so missing documents are listed bare.
func correctionComment(reasons []domain.TriageReason) string {
	var docs []string
	var lines []string
	for _, r := range reasons {
		switch r.Code {
		case domain.TriageMissingDocument:
			docs = append(docs, r.DocumentNameKk)
		case domain.TriageRoomUnavailable:
			lines = append(lines, fmt.Sprintf("таңдаған бөлмеңіз қолжетімсіз (%s), басқа бөлме таңдаңыз", r.Detail))
		case domain.TriageDocumentUnreadable:
			lines = append(lines, fmt.Sprintf("«%s» оқылмайды, анығырақ көшірмесін жүктеңіз", r.DocumentNameKk))
		case domain.TriageWrongDocumentType:
			lines = append(lines, fmt.Sprintf("«%s» орнына басқа құжат жүктелген, дұрысын жүктеңіз", r.DocumentNameKk))
		case domain.TriageUnsupportedFormat:
			lines = append(lines, fmt.Sprintf("«%s» файлын ашу мүмкін емес, PDF немесе сурет (JPG, PNG) ретінде жүктеңіз", r.DocumentNameKk))
		case domain.TriageDocumentExpired:
			lines = append(lines, fmt.Sprintf("«%s» мерзімі өткен (берілген күні %s), жаңасын жүктеңіз", r.DocumentNameKk, r.Detail))
		}
	}
	if len(docs) > 0 {
		lines = append([]string{strings.Join(docs, ", ")}, lines...)
	}
	return strings.Join(lines, "; ")
}
