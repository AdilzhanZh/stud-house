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

type NotificationService struct {
	notifications repository.NotificationRepository
	rooms         repository.RoomRepository
	users         repository.UserRepository
	notifier      *notifier.Notifier
}

func NewNotificationService(
	notifications repository.NotificationRepository,
	rooms repository.RoomRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
) *NotificationService {
	return &NotificationService{notifications: notifications, rooms: rooms, users: users, notifier: notifier}
}

type BroadcastAudience string

const (
	BroadcastAll       BroadcastAudience = "all"
	BroadcastDormitory BroadcastAudience = "dormitory"
	BroadcastStudent   BroadcastAudience = "student"
)

// Broadcast is the only manually-composed notification path in the app —
// every other Notify call is a side effect of a status change elsewhere in
// the domain (see notifier.Notifier). It resolves the requested audience to
// a student ID list, then writes one notification row per recipient; a
// partial failure part-way through still returns the count actually sent
// rather than rolling back, since a manager resending to the same audience
// after a hiccup is the expected recovery path (in-app messages aren't a
// financial or state-changing action, unlike e.g. contract decisions).
func (s *NotificationService) Broadcast(
	ctx context.Context,
	audience BroadcastAudience,
	dormitoryID, studentID *uuid.UUID,
	title, body string,
) (int, error) {
	if title == "" || body == "" {
		return 0, apperror.BadRequest("тақырып пен мәтін міндетті")
	}

	var recipientIDs []uuid.UUID
	switch audience {
	case BroadcastAll:
		students, err := s.users.ListByRole(ctx, domain.RoleStudent)
		if err != nil {
			return 0, err
		}
		for _, u := range students {
			recipientIDs = append(recipientIDs, u.ID)
		}
	case BroadcastDormitory:
		if dormitoryID == nil {
			return 0, apperror.BadRequest("жатақхана таңдалмаған")
		}
		ids, err := s.rooms.ListResidentStudentIDsByDormitory(ctx, *dormitoryID)
		if err != nil {
			return 0, err
		}
		recipientIDs = ids
	case BroadcastStudent:
		if studentID == nil {
			return 0, apperror.BadRequest("студент таңдалмаған")
		}
		recipientIDs = []uuid.UUID{*studentID}
	default:
		return 0, apperror.BadRequest("аудитория түрі белгісіз")
	}

	sent := 0
	for _, recipientID := range recipientIDs {
		if err := s.notifier.Notify(ctx, recipientID, domain.NotificationAdminBroadcast, title, body, nil); err != nil {
			return sent, err
		}
		sent++
	}
	return sent, nil
}

func (s *NotificationService) ListMine(ctx context.Context, userID uuid.UUID) ([]*domain.Notification, error) {
	return s.notifications.ListByUser(ctx, userID)
}

func (s *NotificationService) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	if err := s.notifications.MarkRead(ctx, id, userID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("хабарландыру табылмады")
		}
		return err
	}
	return nil
}

func (s *NotificationService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	if err := s.notifications.Delete(ctx, id, userID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("хабарландыру табылмады")
		}
		return err
	}
	return nil
}

func (s *NotificationService) ClearAll(ctx context.Context, userID uuid.UUID) error {
	return s.notifications.DeleteAllByUser(ctx, userID)
}
