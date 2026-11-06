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
)

const errReferralNotFound = "жолдама табылмады"

type ReferralService struct {
	referrals     repository.ReferralRepository
	notifier      *notifier.Notifier
	signatoryName string
}

func NewReferralService(referrals repository.ReferralRepository, notifier *notifier.Notifier, signatoryName string) *ReferralService {
	return &ReferralService{referrals: referrals, notifier: notifier, signatoryName: signatoryName}
}

// OnProtocolApproved must run after ContractService.OnProtocolApproved, which
// places the students. A student it couldn't place yet (one still has to answer
// a contract, say) gets a referral too, but it's only valid once they have a
// room, so they aren't told about it now.
func (s *ReferralService) OnProtocolApproved(ctx context.Context, protocolID uuid.UUID) error {
	studentIDs, err := s.referrals.IssueForProtocol(ctx, protocolID, s.signatoryName)
	if err != nil {
		return err
	}
	for _, studentID := range studentIDs {
		referral, err := s.referrals.GetLatestByStudent(ctx, studentID)
		if err != nil {
			log.Printf("failed to load referral of student %s: %v", studentID, err)
			continue
		}
		if referral.Valid {
			_ = s.notifier.Notify(ctx, studentID, domain.NotificationReferralIssued, "Жолдамаңыз дайын",
				"Комиссия хаттаманы мақұлдады. Жатақханаға жолдамаңызды «Менің орным» бөлімінен ашып, QR кодымен көрсете аласыз.", nil)
		}
	}
	return nil
}

// GetByToken is public: anyone holding the QR code may read the referral.
func (s *ReferralService) GetByToken(ctx context.Context, token string) (*domain.Referral, error) {
	return referralOrNotFound(s.referrals.GetByToken(ctx, token))
}

func (s *ReferralService) GetMine(ctx context.Context, studentID uuid.UUID) (*domain.Referral, error) {
	return referralOrNotFound(s.referrals.GetLatestByStudent(ctx, studentID))
}

func referralOrNotFound(referral *domain.Referral, err error) (*domain.Referral, error) {
	if errors.Is(err, repository.ErrNotFound) {
		return nil, apperror.NotFound(errReferralNotFound)
	}
	return referral, err
}
