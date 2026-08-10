package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

type DecisionAction string

const (
	ActionApprove           DecisionAction = "approve"
	ActionReject            DecisionAction = "reject"
	ActionRequestCorrection DecisionAction = "request_correction"
)

type ApplicationService struct {
	applications repository.ApplicationRepository
	documents    repository.ApplicationDocumentRepository
	dormitories  repository.DormitoryRepository
	roomRepo     repository.RoomRepository
	rooms        *RoomService
	notifier     *notifier.Notifier
}

func NewApplicationService(
	applications repository.ApplicationRepository,
	documents repository.ApplicationDocumentRepository,
	dormitories repository.DormitoryRepository,
	roomRepo repository.RoomRepository,
	rooms *RoomService,
	notifier *notifier.Notifier,
) *ApplicationService {
	return &ApplicationService{
		applications: applications,
		documents:    documents,
		dormitories:  dormitories,
		roomRepo:     roomRepo,
		rooms:        rooms,
		notifier:     notifier,
	}
}

func statusPtr(s domain.ApplicationStatus) *domain.ApplicationStatus { return &s }

// Create submits a new application. It is rejected if the student already
// has an active (non-terminal) application, or is already a settled resident
// of some room (an active room_residents row) — settled students must go
// through a move-out flow, not a new intake application, which is out of
// scope for this phase.
func (s *ApplicationService) Create(ctx context.Context, studentID, dormitoryID uuid.UUID, preferredRoomType, notes *string, preferredRoomID *uuid.UUID, studyGroup, hometown, parentContact string) (*domain.Application, error) {
	if studyGroup == "" || hometown == "" || parentContact == "" {
		return nil, apperror.BadRequest("оқу тобы, келген жеріңіз және ата-ана/жақынның байланыс нөмірі міндетті")
	}
	dormitory, err := s.dormitories.GetByID(ctx, dormitoryID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		return nil, err
	}
	if dormitory.ClosedForApplications {
		return nil, apperror.BadRequest("бұл жатақхана қазір өтініш қабылдамайды")
	}

	if rooms, err := s.roomRepo.ListByDormitory(ctx, dormitoryID); err != nil {
		return nil, err
	} else if len(rooms) == 0 {
		return nil, apperror.BadRequest("бұл жатақханада әлі бөлме енгізілмеген, өтініш беруге болмайды")
	}

	if _, err := s.applications.GetActiveByStudent(ctx, studentID); err == nil {
		return nil, apperror.Conflict("сізде белсенді өтінішіңіз бар")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	if _, err := s.roomRepo.GetActiveResidentByStudent(ctx, studentID); err == nil {
		return nil, apperror.Conflict("сіз бұрыннан бөлмеде тұрасыз, жаңа өтініш беруге болмайды")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	if preferredRoomID != nil {
		room, err := s.roomRepo.GetByID(ctx, *preferredRoomID)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return nil, apperror.NotFound("бөлме табылмады")
			}
			return nil, err
		}
		if room.DormitoryID != dormitoryID {
			return nil, apperror.BadRequest("таңдалған бөлме көрсетілген жатақханаға жатпайды")
		}
		if err := s.rooms.CheckAssignable(ctx, *preferredRoomID, studentID); err != nil {
			return nil, err
		}
	}

	app := &domain.Application{
		StudentID:         studentID,
		DormitoryID:       dormitoryID,
		Status:            domain.ApplicationPending,
		PreferredRoomType: preferredRoomType,
		PreferredRoomID:   preferredRoomID,
		Notes:             notes,
		StudyGroup:        studyGroup,
		Hometown:          hometown,
		ParentContact:     parentContact,
	}
	if err := s.applications.Create(ctx, app); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("сізде белсенді өтінішіңіз бар")
		}
		return nil, err
	}

	if err := s.applications.AddHistory(ctx, &domain.ApplicationStatusHistory{
		ApplicationID: app.ID,
		ToStatus:      domain.ApplicationPending,
		ChangedBy:     studentID,
	}); err != nil {
		return nil, err
	}

	return app, nil
}

// CancelOwn lets a student delete their own application while it is still
// pending, or after it has been rejected. The pending case rolls back a
// submission whose document/benefit attachment failed partway through
// (NewApplicationPage uploads files and creates the application, then
// attaches document metadata; if that last step fails, it calls this to
// undo the create rather than leaving a half-submitted application behind).
// The rejected case lets a student clear a dead-end application out of
// their list once GetActiveByStudent no longer counts it against them.
func (s *ApplicationService) CancelOwn(ctx context.Context, studentID, applicationID uuid.UUID) error {
	app, err := s.GetByID(ctx, applicationID)
	if err != nil {
		return err
	}
	if app.StudentID != studentID {
		return apperror.Forbidden("тек өз өтінішіңізді өшіре аласыз")
	}
	if app.Status != domain.ApplicationPending && app.Status != domain.ApplicationRejected {
		return apperror.Conflict("тек шешім қабылдауды күтіп тұрған немесе қабылданбаған өтінішті өшіруге болады")
	}
	if err := s.applications.Delete(ctx, applicationID); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return apperror.Conflict("бұл өтініш басқа жазбамен байланысты, оны өшіру мүмкін емес")
		}
		return err
	}
	return nil
}

func (s *ApplicationService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Application, error) {
	app, err := s.applications.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("өтініш табылмады")
		}
		return nil, err
	}
	return app, nil
}

func (s *ApplicationService) ListMine(ctx context.Context, studentID uuid.UUID) ([]*domain.Application, error) {
	return s.applications.ListByStudent(ctx, studentID)
}

func (s *ApplicationService) List(ctx context.Context, status *domain.ApplicationStatus) ([]*domain.Application, error) {
	return s.applications.List(ctx, status)
}

func (s *ApplicationService) ListHistory(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationStatusHistory, error) {
	return s.applications.ListHistory(ctx, applicationID)
}

// AddDocument attaches a document to the student's own application, while it
// is still editable (pending / needs_correction). Exactly one of
// benefitRequiredDocumentID, dormitoryRequiredDocumentID, or documentName
// must be given.
func (s *ApplicationService) AddDocument(ctx context.Context, actorStudentID, applicationID uuid.UUID, benefitRequiredDocumentID, dormitoryRequiredDocumentID *uuid.UUID, documentName *string, fileURL string) (*domain.ApplicationDocument, error) {
	if fileURL == "" {
		return nil, apperror.BadRequest("файл сілтемесі міндетті")
	}
	setCount := 0
	for _, set := range []bool{benefitRequiredDocumentID != nil, dormitoryRequiredDocumentID != nil, documentName != nil} {
		if set {
			setCount++
		}
	}
	if setCount != 1 {
		return nil, apperror.BadRequest("льгота құжаты, жатақхана құжаты немесе құжат атауының тек біреуі көрсетілуі керек")
	}

	app, err := s.GetByID(ctx, applicationID)
	if err != nil {
		return nil, err
	}
	if app.StudentID != actorStudentID {
		return nil, apperror.Forbidden("тек өз өтінішіңізге құжат жүктей аласыз")
	}
	if app.Status == domain.ApplicationApproved || app.Status == domain.ApplicationRejected {
		return nil, apperror.BadRequest("аяқталған өтінішке құжат қосуға болмайды")
	}

	doc := &domain.ApplicationDocument{
		ApplicationID:               applicationID,
		BenefitRequiredDocumentID:   benefitRequiredDocumentID,
		DormitoryRequiredDocumentID: dormitoryRequiredDocumentID,
		DocumentName:                documentName,
		FileURL:                     fileURL,
	}
	if err := s.documents.Add(ctx, doc); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.BadRequest("көрсетілген құжат жарамсыз")
		}
		return nil, err
	}
	return doc, nil
}

func (s *ApplicationService) ListDocuments(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationDocument, error) {
	return s.documents.ListByApplication(ctx, applicationID)
}

// Resubmit lets the owning student edit their application while it is in
// needs_correction, moving it back to pending in the same operation.
func (s *ApplicationService) Resubmit(ctx context.Context, actorStudentID, applicationID uuid.UUID, preferredRoomType, notes *string) (*domain.Application, error) {
	err := s.applications.WithLock(ctx, applicationID, func(ctx context.Context, app *domain.Application, tx repository.ApplicationTx) error {
		if app.StudentID != actorStudentID {
			return apperror.Forbidden("тек өз өтінішіңізді өзгерте аласыз")
		}
		if app.Status != domain.ApplicationNeedsCorrection {
			return apperror.BadRequest("өтінішті тек түзету қажет болған кезде ғана өзгертуге болады")
		}
		if err := tx.UpdateEditableFieldsAndResubmit(ctx, applicationID, preferredRoomType, notes); err != nil {
			return err
		}
		return tx.AddHistory(ctx, &domain.ApplicationStatusHistory{
			ApplicationID: applicationID,
			FromStatus:    statusPtr(domain.ApplicationNeedsCorrection),
			ToStatus:      domain.ApplicationPending,
			ChangedBy:     actorStudentID,
		})
	})
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, applicationID)
}

// Decide processes a manager's decision on a pending application. The
// pending -> manager_review -> final transition happens atomically in a
// single request (no separate "claim" endpoint): the application row is
// locked for the duration, so two concurrent decisions on the same
// application serialize and the second one sees a non-pending status.
//
// On approve, roomID is optional: a manager may assign a room immediately
// (reusing RoomService.AddResident's capacity + restriction validation from
// phase 1) before the application's own status is committed — if that room
// assignment fails, nothing about the application is changed. If the manager
// leaves roomID unset, this falls back to the student's own PreferredRoomID
// (chosen at application time): a manager with no objection to that choice
// can approve without picking anything themselves, rather than the student
// silently ending up unassigned. Only a student who never expressed a room
// preference is left unassigned for now, to be placed in a room later.
func (s *ApplicationService) Decide(ctx context.Context, actorID, applicationID uuid.UUID, action DecisionAction, roomID *uuid.UUID, comment *string) (*domain.Application, error) {
	var finalStatus domain.ApplicationStatus
	var studentID uuid.UUID

	err := s.applications.WithLock(ctx, applicationID, func(ctx context.Context, app *domain.Application, tx repository.ApplicationTx) error {
		if app.Status != domain.ApplicationPending {
			return apperror.Conflict("өтініш шешім қабылдауды күтіп тұрған жоқ")
		}
		studentID = app.StudentID

		if err := tx.AddHistory(ctx, &domain.ApplicationStatusHistory{
			ApplicationID: applicationID,
			FromStatus:    statusPtr(domain.ApplicationPending),
			ToStatus:      domain.ApplicationManagerReview,
			ChangedBy:     actorID,
		}); err != nil {
			return err
		}

		switch action {
		case ActionApprove:
			if roomID == nil {
				roomID = app.PreferredRoomID
			}
			if roomID != nil {
				if _, err := s.rooms.AddResident(ctx, *roomID, app.StudentID); err != nil {
					return err
				}
			}
			finalStatus = domain.ApplicationApproved
			if err := tx.SetDecision(ctx, applicationID, finalStatus, roomID, actorID); err != nil {
				return err
			}
		case ActionReject:
			if comment == nil || *comment == "" {
				return apperror.BadRequest("қабылдамау үшін пікір міндетті")
			}
			finalStatus = domain.ApplicationRejected
			if err := tx.SetDecision(ctx, applicationID, finalStatus, nil, actorID); err != nil {
				return err
			}
		case ActionRequestCorrection:
			if comment == nil || *comment == "" {
				return apperror.BadRequest("түзету сұрау үшін пікір міндетті")
			}
			finalStatus = domain.ApplicationNeedsCorrection
			if err := tx.SetDecision(ctx, applicationID, finalStatus, nil, actorID); err != nil {
				return err
			}
		default:
			return apperror.BadRequest("әрекет жарамсыз")
		}

		return tx.AddHistory(ctx, &domain.ApplicationStatusHistory{
			ApplicationID: applicationID,
			FromStatus:    statusPtr(domain.ApplicationManagerReview),
			ToStatus:      finalStatus,
			Comment:       comment,
			ChangedBy:     actorID,
		})
	})
	if err != nil {
		return nil, err
	}

	s.notifyDecision(ctx, studentID, applicationID, finalStatus, comment)

	return s.GetByID(ctx, applicationID)
}

// notifyDecision is best-effort: the decision has already been committed, so
// a notification (in-app or email) failure is logged but does not fail the
// request.
func (s *ApplicationService) notifyDecision(ctx context.Context, studentID, applicationID uuid.UUID, status domain.ApplicationStatus, comment *string) {
	title, body := decisionNotificationText(status, comment)
	notifType := domain.NotificationApplicationStatusChanged
	if status == domain.ApplicationNeedsCorrection {
		notifType = domain.NotificationDocumentRequested
	}
	_ = s.notifier.Notify(ctx, studentID, notifType, title, body, &applicationID)
}

func decisionNotificationText(status domain.ApplicationStatus, comment *string) (title, body string) {
	switch status {
	case domain.ApplicationApproved:
		return "Өтінішіңіз мақұлданды", "Сіздің жатақханаға өтінішіңіз мақұлданды, бөлме тағайындалды."
	case domain.ApplicationRejected:
		reason := ""
		if comment != nil {
			reason = *comment
		}
		return "Өтінішіңіз қабылданбады", fmt.Sprintf("Сіздің өтінішіңіз қабылданбады. Себебі: %s", reason)
	case domain.ApplicationNeedsCorrection:
		reason := ""
		if comment != nil {
			reason = *comment
		}
		return "Өтінішіңізде түзету қажет", fmt.Sprintf("Мына құжатыңыз/деректеріңіз толық емес: %s", reason)
	default:
		return "Өтініш статусы өзгерді", "Сіздің өтінішіңіздің статусы өзгерді."
	}
}
