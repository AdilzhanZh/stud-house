package service

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type stubCertificateRepo struct {
	err           error
	signatoryName string
}

func (r *stubCertificateRepo) Issue(_ context.Context, _ uuid.UUID, signatoryName string) (*domain.ResidenceCertificate, error) {
	r.signatoryName = signatoryName
	if r.err != nil {
		return nil, r.err
	}
	return &domain.ResidenceCertificate{SignatoryName: signatoryName}, nil
}

func (r *stubCertificateRepo) GetByToken(context.Context, string) (*domain.ResidenceCertificate, error) {
	return nil, r.err
}

func (r *stubCertificateRepo) GetLatestByStudent(context.Context, uuid.UUID) (*domain.ResidenceCertificate, error) {
	return nil, r.err
}

func appErrorStatus(t *testing.T, err error) int {
	t.Helper()
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("want an apperror, got %v", err)
	}
	return appErr.Status
}

func TestResidenceCertificateIssueSignsWithConfiguredName(t *testing.T) {
	repo := &stubCertificateRepo{}
	certificate, err := NewResidenceCertificateService(repo, "У.С. Ибраев").Issue(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if certificate.SignatoryName != "У.С. Ибраев" || repo.signatoryName != "У.С. Ибраев" {
		t.Errorf("signatory = %q", certificate.SignatoryName)
	}
}

func TestResidenceCertificateIssueRefusesStudentWithoutRoom(t *testing.T) {
	s := NewResidenceCertificateService(&stubCertificateRepo{err: repository.ErrNotFound}, "")
	_, err := s.Issue(context.Background(), uuid.New())
	if status := appErrorStatus(t, err); status != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", status)
	}
}

func TestResidenceCertificateLookupsMapMissingToNotFound(t *testing.T) {
	s := NewResidenceCertificateService(&stubCertificateRepo{err: repository.ErrNotFound}, "")
	_, err := s.GetByToken(context.Background(), "unknown")
	if status := appErrorStatus(t, err); status != http.StatusNotFound {
		t.Errorf("GetByToken status = %d, want 404", status)
	}
	_, err = s.GetMine(context.Background(), uuid.New())
	if status := appErrorStatus(t, err); status != http.StatusNotFound {
		t.Errorf("GetMine status = %d, want 404", status)
	}
}

func TestResidenceCertificateIssuePassesOtherErrorsThrough(t *testing.T) {
	boom := errors.New("boom")
	_, err := NewResidenceCertificateService(&stubCertificateRepo{err: boom}, "").Issue(context.Background(), uuid.New())
	if !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}
