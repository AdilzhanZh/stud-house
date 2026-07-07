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

type TransferRequestService struct {
	transferRequests repository.TransferRequestRepository
	applications     repository.ApplicationRepository
	rooms            repository.RoomRepository
	roomService      *RoomService
	users            repository.UserRepository
	notifier         *notifier.Notifier
}

func NewTransferRequestService(
	transferRequests repository.TransferRequestRepository,
	applications repository.ApplicationRepository,
	rooms repository.RoomRepository,
	roomService *RoomService,
	users repository.UserRepository,
	notifier *notifier.Notifier,
) *TransferRequestService {
	return &TransferRequestService{
		transferRequests: transferRequests,
		applications:     applications,
		rooms:            rooms,
		roomService:      roomService,
		users:            users,
		notifier:         notifier,
	}
}

// Create is student-only: it resolves the caller's own active room stay and
// blocks the request if they have any unresolved application or transfer
// request in flight (same "one active thing" invariant as phases 2/4).
func (s *TransferRequestService) Create(ctx context.Context, studentID uuid.UUID, requestedDormitoryID, requestedRoomID *uuid.UUID, reason *string) (*domain.TransferRequest, error) {
	resident, err := s.rooms.GetActiveResidentByStudent(ctx, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.BadRequest("you don't have an active room assignment")
		}
		return nil, err
	}

	if _, err := s.applications.GetActiveByStudent(ctx, studentID); err == nil {
		return nil, apperror.Conflict("you have an unresolved application; resolve it before requesting a transfer")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	if _, err := s.transferRequests.GetActiveByStudent(ctx, studentID); err == nil {
		return nil, apperror.Conflict("you already have a pending transfer request")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	tr := &domain.TransferRequest{
		StudentID:            studentID,
		CurrentRoomID:        resident.RoomID,
		RequestedDormitoryID: requestedDormitoryID,
		RequestedRoomID:      requestedRoomID,
		Reason:               reason,
		Status:               domain.TransferRequestPending,
	}
	if err := s.transferRequests.Create(ctx, tr); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("you already have a pending transfer request")
		}
		return nil, err
	}

	s.notifyManagersNewTransferRequest(ctx, tr)
	return tr, nil
}

func (s *TransferRequestService) GetByID(ctx context.Context, id uuid.UUID) (*domain.TransferRequest, error) {
	t, err := s.transferRequests.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("transfer request not found")
		}
		return nil, err
	}
	return t, nil
}

func (s *TransferRequestService) ListMine(ctx context.Context, studentID uuid.UUID) ([]*domain.TransferRequest, error) {
	return s.transferRequests.ListByStudent(ctx, studentID)
}

func (s *TransferRequestService) List(ctx context.Context, status *domain.TransferRequestStatus) ([]*domain.TransferRequest, error) {
	return s.transferRequests.List(ctx, status)
}

// Decide is manager/admin-only. On approve, the actual room move (reusing
// phase-1 RoomService.AddResident for capacity/restriction validation)
// happens INSIDE the lock, before the transfer_request itself is marked
// approved — if the new room fails validation, the request rolls back to
// 'pending' instead of being wrongly marked approved.
func (s *TransferRequestService) Decide(ctx context.Context, actorID, transferRequestID uuid.UUID, action string, roomID *uuid.UUID, comment *string) (*domain.TransferRequest, error) {
	var studentID uuid.UUID

	err := s.transferRequests.WithLock(ctx, transferRequestID, func(ctx context.Context, tr *domain.TransferRequest, tx repository.TransferRequestTx) error {
		if tr.Status != domain.TransferRequestPending {
			return apperror.Conflict("transfer request has already been decided")
		}
		studentID = tr.StudentID

		switch action {
		case "approve":
			if roomID == nil {
				return apperror.BadRequest("room_id is required to approve")
			}
			resident, err := s.rooms.GetActiveResidentByStudent(ctx, tr.StudentID)
			if err != nil {
				return err
			}
			if err := s.rooms.MoveOutResident(ctx, resident.ID); err != nil {
				return err
			}
			// NOTE: if AddResident fails here, the old room has already
			// been vacated (MoveOutResident above isn't part of this same
			// DB transaction — same documented cross-repository trade-off
			// as earlier phases). The transfer_request itself still rolls
			// back to 'pending' since we haven't called SetDecision yet.
			if _, err := s.roomService.AddResident(ctx, *roomID, tr.StudentID); err != nil {
				return err
			}
			return tx.SetDecision(ctx, transferRequestID, domain.TransferRequestApproved, actorID, comment)
		case "reject":
			if comment == nil || *comment == "" {
				return apperror.BadRequest("comment is required to reject")
			}
			return tx.SetDecision(ctx, transferRequestID, domain.TransferRequestRejected, actorID, comment)
		default:
			return apperror.BadRequest("invalid action")
		}
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, transferRequestID)
	if err != nil {
		return nil, err
	}
	s.notifyStudentDecision(ctx, studentID, updated)
	return updated, nil
}

func (s *TransferRequestService) notifyManagersNewTransferRequest(ctx context.Context, tr *domain.TransferRequest) {
	const body = "Жаңа бөлме/жатақхана ауыстыру өтініші қаралуды күтуде."
	for _, role := range []domain.Role{domain.RoleAdmin, domain.RoleManager} {
		staff, err := s.users.ListByRole(ctx, role)
		if err != nil {
			continue
		}
		for _, u := range staff {
			_ = s.notifier.Notify(ctx, u.ID, domain.NotificationTransferRequestUpdate, "Жаңа ауыстыру өтініші", body, nil)
		}
	}
}

func (s *TransferRequestService) notifyStudentDecision(ctx context.Context, studentID uuid.UUID, tr *domain.TransferRequest) {
	title, body := "Ауыстыру өтінішіңіз мақұлданды", "Сіздің бөлме ауыстыру өтінішіңіз мақұлданды."
	if tr.Status == domain.TransferRequestRejected {
		title, body = "Ауыстыру өтінішіңіз қабылданбады", "Сіздің бөлме ауыстыру өтінішіңіз қабылданбады."
	}
	_ = s.notifier.Notify(ctx, studentID, domain.NotificationTransferRequestUpdate, title, body, nil)
}
