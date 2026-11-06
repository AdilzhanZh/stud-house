package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

const (
	errCertificateNotFound  = "анықтама табылмады"
	errCertificateNotHoused = "сіз қазір жатақханада тұрмайсыз, анықтама алу мүмкін емес"
)

// ResidenceCertificateService lets a student issue their own certificate of
// residence. It is signed with the same prorector's name as referrals.
type ResidenceCertificateService struct {
	certificates  repository.ResidenceCertificateRepository
	signatoryName string
}

func NewResidenceCertificateService(certificates repository.ResidenceCertificateRepository, signatoryName string) *ResidenceCertificateService {
	return &ResidenceCertificateService{certificates: certificates, signatoryName: signatoryName}
}

// Issue always creates a new certificate, dated today: a student asks for one
// because they need a fresh date or their details changed.
func (s *ResidenceCertificateService) Issue(ctx context.Context, studentID uuid.UUID) (*domain.ResidenceCertificate, error) {
	certificate, err := s.certificates.Issue(ctx, studentID, s.signatoryName)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, apperror.BadRequest(errCertificateNotHoused)
	}
	return certificate, err
}

// GetByToken is public: anyone holding the QR code may read the certificate.
func (s *ResidenceCertificateService) GetByToken(ctx context.Context, token string) (*domain.ResidenceCertificate, error) {
	return certificateOrNotFound(s.certificates.GetByToken(ctx, token))
}

func (s *ResidenceCertificateService) GetMine(ctx context.Context, studentID uuid.UUID) (*domain.ResidenceCertificate, error) {
	return certificateOrNotFound(s.certificates.GetLatestByStudent(ctx, studentID))
}

func certificateOrNotFound(certificate *domain.ResidenceCertificate, err error) (*domain.ResidenceCertificate, error) {
	if errors.Is(err, repository.ErrNotFound) {
		return nil, apperror.NotFound(errCertificateNotFound)
	}
	return certificate, err
}
