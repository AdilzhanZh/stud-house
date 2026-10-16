package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

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
		if detail, err := s.checkPreferredRoom(ctx, a); err != nil {
			return nil, err
		} else if detail != "" {
			t.Reasons = append(t.Reasons, domain.TriageReason{Code: domain.TriageRoomUnavailable, Detail: detail})
		}
		if len(t.Reasons) > 0 {
			t.Color = domain.TriageYellow
		}
		out = append(out, t)
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
		}
	}
	if len(docs) > 0 {
		lines = append([]string{strings.Join(docs, ", ")}, lines...)
	}
	return strings.Join(lines, "; ")
}
