package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type stubReferralRepo struct {
	repository.ReferralRepository
	err error
}

func (r stubReferralRepo) GetByToken(context.Context, string) (*domain.Referral, error) {
	return &domain.Referral{Token: "t"}, r.err
}

func (r stubReferralRepo) IssueForProtocol(context.Context, uuid.UUID, string) ([]uuid.UUID, error) {
	return nil, r.err
}

func TestReferralGetByTokenMapsMissingToNotFound(t *testing.T) {
	s := NewReferralService(stubReferralRepo{err: repository.ErrNotFound}, nil, "")
	_, err := s.GetByToken(context.Background(), "unknown")
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("want an apperror, got %v", err)
	}
}

func TestReferralOnProtocolApprovedReportsIssueFailure(t *testing.T) {
	boom := errors.New("boom")
	s := NewReferralService(stubReferralRepo{err: boom}, nil, "")
	if err := s.OnProtocolApproved(context.Background(), uuid.New()); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestValidateReferralTemplatePages(t *testing.T) {
	if err := validateReferralTemplatePages(defaultReferralTemplatePages); err != nil {
		t.Fatalf("the default template must be valid: %v", err)
	}
	withoutRoom := strings.ReplaceAll(defaultReferralTemplatePages[0], `data-token="{{room_number}}"`, "")
	for name, pages := range map[string][]string{
		"no pages":       {},
		"blank page":     {defaultReferralTemplatePages[0], "  "},
		"missing a room": {withoutRoom},
	} {
		if err := validateReferralTemplatePages(pages); err == nil {
			t.Errorf("%s: want an error", name)
		}
	}
}
