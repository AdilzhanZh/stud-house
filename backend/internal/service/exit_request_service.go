package service

import (
	"context"
	"errors"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
	"student-house/pkg/mailer"
)

type ExitRequestService struct {
	exitRequests repository.ExitRequestRepository
	rooms        repository.RoomRepository
	users        repository.UserRepository
	notifier     *notifier.Notifier
	mailer       *mailer.Mailer
}

func NewExitRequestService(
	exitRequests repository.ExitRequestRepository,
	rooms repository.RoomRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
	m *mailer.Mailer,
) *ExitRequestService {
	return &ExitRequestService{exitRequests: exitRequests, rooms: rooms, users: users, notifier: notifier, mailer: m}
}

// Create is student-only: it looks up the caller's own active room stay
// (moved_out_at IS NULL) rather than accepting a room_resident_id directly.
func (s *ExitRequestService) Create(ctx context.Context, studentID uuid.UUID, reason *string) (*domain.ExitRequest, error) {
	resident, err := s.rooms.GetActiveResidentByStudent(ctx, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.BadRequest("сізде белсенді бөлмеге орналасу жоқ")
		}
		return nil, err
	}

	if _, err := s.exitRequests.GetActiveByRoomResident(ctx, resident.ID); err == nil {
		return nil, apperror.Conflict("сізде қаралуда тұрған шығу өтініші бар")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	er := &domain.ExitRequest{RoomResidentID: resident.ID, StudentID: studentID, Reason: reason, Status: domain.ExitRequestPending}
	if err := s.exitRequests.Create(ctx, er); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("сізде қаралуда тұрған шығу өтініші бар")
		}
		return nil, err
	}

	s.notifyManagersNewExitRequest(ctx, er)
	return er, nil
}

func (s *ExitRequestService) GetByID(ctx context.Context, id uuid.UUID) (*domain.ExitRequest, error) {
	e, err := s.exitRequests.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("шығу өтініші табылмады")
		}
		return nil, err
	}
	return e, nil
}

func (s *ExitRequestService) ListMine(ctx context.Context, studentID uuid.UUID) ([]*domain.ExitRequest, error) {
	return s.exitRequests.ListByStudent(ctx, studentID)
}

func (s *ExitRequestService) List(ctx context.Context, status *domain.ExitRequestStatus) ([]*domain.ExitRequest, error) {
	return s.exitRequests.List(ctx, status)
}

// Decide is manager/admin-only. Approving closes the underlying
// room_residents row (moved_out_at = now()) via the phase-2/1 RoomRepository
// — a separate call from the exit_requests status update (not the same DB
// transaction), the same trade-off already documented in earlier phases.
func (s *ExitRequestService) Decide(ctx context.Context, actorID, exitRequestID uuid.UUID, action string, comment *string) (*domain.ExitRequest, error) {
	var approvedResidentID uuid.UUID
	var approved bool

	err := s.exitRequests.WithLock(ctx, exitRequestID, func(ctx context.Context, e *domain.ExitRequest, tx repository.ExitRequestTx) error {
		if e.Status != domain.ExitRequestPending {
			return apperror.Conflict("шығу өтініші бойынша шешім бұрын қабылданды")
		}
		switch action {
		case "approve":
			approved = true
			approvedResidentID = e.RoomResidentID
			return tx.SetDecision(ctx, exitRequestID, domain.ExitRequestApproved, actorID, comment)
		case "reject":
			if comment == nil || *comment == "" {
				return apperror.BadRequest("қабылдамау үшін пікір міндетті")
			}
			return tx.SetDecision(ctx, exitRequestID, domain.ExitRequestRejected, actorID, comment)
		default:
			return apperror.BadRequest("әрекет жарамсыз")
		}
	})
	if err != nil {
		return nil, err
	}

	if approved {
		if err := s.rooms.MoveOutResident(ctx, approvedResidentID); err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
	}

	updated, err := s.GetByID(ctx, exitRequestID)
	if err != nil {
		return nil, err
	}
	s.notifyStudentDecision(ctx, updated)
	return updated, nil
}

func (s *ExitRequestService) notifyStudentDecision(ctx context.Context, e *domain.ExitRequest) {
	title, body := "Шығу өтінішіңіз мақұлданды", "Сіздің жатақханадан шығу өтінішіңіз мақұлданды."
	if e.Status == domain.ExitRequestRejected {
		title, body = "Шығу өтінішіңіз қабылданбады", "Сіздің жатақханадан шығу өтінішіңіз қабылданбады."
	}
	_ = s.notifier.Notify(ctx, e.StudentID, domain.NotificationExitRequestUpdate, title, body, nil)

	if student, err := s.users.GetByID(ctx, e.StudentID); err == nil {
		go func(email, subject, body string) {
			if err := s.mailer.Send(email, subject, body); err != nil {
				log.Printf("failed to send exit-request-decision email to %s: %v", email, err)
			}
		}(student.Email, title, body)
	}
}

func (s *ExitRequestService) notifyManagersNewExitRequest(ctx context.Context, e *domain.ExitRequest) {
	const body = "Жаңа шығу өтініші қаралуды күтуде."
	for _, role := range []domain.Role{domain.RoleAdmin, domain.RoleManager} {
		staff, err := s.users.ListByRole(ctx, role)
		if err != nil {
			continue
		}
		for _, u := range staff {
			_ = s.notifier.Notify(ctx, u.ID, domain.NotificationExitRequestUpdate, "Жаңа шығу өтініші", body, nil)
		}
	}
}
