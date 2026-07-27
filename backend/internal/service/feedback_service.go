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
	users         repository.UserRepository
	notifier      *notifier.Notifier
	mailer        *mailer.Mailer
	feedbackEmail string
}

func NewFeedbackService(users repository.UserRepository, notifier *notifier.Notifier, mailer *mailer.Mailer, feedbackEmail string) *FeedbackService {
	return &FeedbackService{users: users, notifier: notifier, mailer: mailer, feedbackEmail: feedbackEmail}
}

// Send delivers a student/staff-composed bug report or suggestion two ways:
// as an in-app notification to every admin (so it's visible even if email is
// disabled/misconfigured), and as a single email to cfg.FeedbackEmail — one
// fixed, actually-monitored inbox, deliberately not every role=admin DB
// user's email, since those are frequently placeholder/fixture addresses
// (e.g. admin@example.com) that just bounce.
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

	title := "Жаңа ұсыныс/қате хабарламасы"
	body := fmt.Sprintf(
		"%s (%s, %s) хабарлама жіберді:\n\n%s",
		actor.FullName, actor.Email, actor.Phone, message,
	)
	for _, admin := range admins {
		_ = s.notifier.Notify(ctx, admin.ID, domain.NotificationFeedback, title, body, nil)
	}
	if s.feedbackEmail != "" {
		if err := s.mailer.Send(s.feedbackEmail, title, body); err != nil {
			log.Printf("failed to email feedback to %s: %v", s.feedbackEmail, err)
		}
	}
	return nil
}
