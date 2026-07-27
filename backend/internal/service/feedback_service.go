package service

import (
	"context"
	"fmt"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
	"student-house/pkg/mailer"
)

const feedbackMessageMaxLen = 4000

type FeedbackService struct {
	users    repository.UserRepository
	notifier *notifier.Notifier
	mailer   *mailer.Mailer
}

func NewFeedbackService(users repository.UserRepository, notifier *notifier.Notifier, mailer *mailer.Mailer) *FeedbackService {
	return &FeedbackService{users: users, notifier: notifier, mailer: mailer}
}

// Send delivers a student/staff-composed bug report or suggestion to every
// admin — as an in-app notification (so it's visible even if email is
// disabled/misconfigured) and, unlike every other notification.Notify call
// in this codebase, also directly by email regardless of recipient role:
// the whole point of this feature is that it reaches the admin's inbox, not
// just their in-app notification list.
func (s *FeedbackService) Send(ctx context.Context, actorID uuid.UUID, message string) error {
	if message == "" {
		return apperror.BadRequest("хабарлама мәтіні міндетті")
	}
	if len(message) > feedbackMessageMaxLen {
		return apperror.BadRequest("хабарлама тым ұзын")
	}

	actor, err := s.users.GetByID(ctx, actorID)
	if err != nil {
		return err
	}

	admins, err := s.users.ListByRole(ctx, domain.RoleAdmin)
	if err != nil {
		return err
	}
	if len(admins) == 0 {
		return apperror.Internal("жүйеде әкімші табылмады")
	}

	title := "Жаңа ұсыныс/қате хабарламасы"
	body := fmt.Sprintf(
		"%s (%s, %s) хабарлама жіберді:\n\n%s",
		actor.FullName, actor.Email, actor.Phone, message,
	)
	for _, admin := range admins {
		_ = s.notifier.Notify(ctx, admin.ID, domain.NotificationFeedback, title, body, nil)
		if err := s.mailer.Send(admin.Email, title, body); err != nil {
			log.Printf("failed to email feedback to admin %s: %v", admin.Email, err)
		}
	}
	return nil
}
