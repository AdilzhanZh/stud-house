package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type NotificationService struct {
	notifications repository.NotificationRepository
}

func NewNotificationService(notifications repository.NotificationRepository) *NotificationService {
	return &NotificationService{notifications: notifications}
}

func (s *NotificationService) ListMine(ctx context.Context, userID uuid.UUID) ([]*domain.Notification, error) {
	return s.notifications.ListByUser(ctx, userID)
}

func (s *NotificationService) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	if err := s.notifications.MarkRead(ctx, id, userID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("notification not found")
		}
		return err
	}
	return nil
}
