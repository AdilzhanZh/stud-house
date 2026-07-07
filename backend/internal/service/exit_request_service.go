package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

type ExitRequestService struct {
	exitRequests repository.ExitRequestRepository
	rooms        repository.RoomRepository
	users        repository.UserRepository
	notifier     *notifier.Notifier
}

func NewExitRequestService(
	exitRequests repository.ExitRequestRepository,
	rooms repository.RoomRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
) *ExitRequestService {
	return &ExitRequestService{exitRequests: exitRequests, rooms: rooms, users: users, notifier: notifier}
}

// Create is student-only: it looks up the caller's own active room stay
// (moved_out_at IS NULL) rather than accepting a room_resident_id directly.
func (s *ExitRequestService) Create(ctx context.Context, studentID uuid.UUID, reason *string) (*domain.ExitRequest, error) {
	resident, err := s.rooms.GetActiveResidentByStudent(ctx, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.BadRequest("you don't have an active room assignment")
		}
		return nil, err
	}

	if _, err := s.exitRequests.GetActiveByRoomResident(ctx, resident.ID); err == nil {
		return nil, apperror.Conflict("you already have a pending exit request")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	er := &domain.ExitRequest{RoomResidentID: resident.ID, StudentID: studentID, Reason: reason, Status: domain.ExitRequestPending}
	if err := s.exitRequests.Create(ctx, er); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("you already have a pending exit request")
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
			return nil, apperror.NotFound("exit request not found")
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
			return apperror.Conflict("exit request has already been decided")
		}
		switch action {
		case "approve":
			approved = true
			approvedResidentID = e.RoomResidentID
			return tx.SetDecision(ctx, exitRequestID, domain.ExitRequestApproved, actorID, comment)
		case "reject":
			if comment == nil || *comment == "" {
				return apperror.BadRequest("comment is required to reject")
			}
			return tx.SetDecision(ctx, exitRequestID, domain.ExitRequestRejected, actorID, comment)
		default:
			return apperror.BadRequest("invalid action")
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

	return s.GetByID(ctx, exitRequestID)
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
