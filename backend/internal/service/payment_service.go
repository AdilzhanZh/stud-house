package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

type PaymentService struct {
	payments     repository.PaymentRepository
	contracts    repository.ContractRepository
	applications repository.ApplicationRepository
	users        repository.UserRepository
	notifier     *notifier.Notifier
}

func NewPaymentService(
	payments repository.PaymentRepository,
	contracts repository.ContractRepository,
	applications repository.ApplicationRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
) *PaymentService {
	return &PaymentService{
		payments:     payments,
		contracts:    contracts,
		applications: applications,
		users:        users,
		notifier:     notifier,
	}
}

func (s *PaymentService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Payment, error) {
	p, err := s.payments.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("payment not found")
		}
		return nil, err
	}
	return p, nil
}

func (s *PaymentService) GetByContractID(ctx context.Context, contractID uuid.UUID) (*domain.Payment, error) {
	p, err := s.payments.GetByContractID(ctx, contractID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("payment not found for this contract")
		}
		return nil, err
	}
	return p, nil
}

// Submit lets the owning student attach a receipt while the contract is
// accepted; it may be called again after a rejection to resubmit.
func (s *PaymentService) Submit(ctx context.Context, actorStudentID, paymentID uuid.UUID, receiptFileURL string) (*domain.Payment, error) {
	if receiptFileURL == "" {
		return nil, apperror.BadRequest("receipt_file_url is required")
	}

	var applicationID uuid.UUID
	err := s.payments.WithLock(ctx, paymentID, func(ctx context.Context, payment *domain.Payment, tx repository.PaymentTx) error {
		if payment.Status == domain.PaymentConfirmed {
			return apperror.Conflict("payment has already been confirmed")
		}
		contract, err := s.contracts.GetByID(ctx, payment.ContractID)
		if err != nil {
			return err
		}
		if contract.Status != domain.ContractAccepted {
			return apperror.Conflict("contract is not accepted")
		}
		app, err := s.applications.GetByID(ctx, contract.ApplicationID)
		if err != nil {
			return err
		}
		if app.StudentID != actorStudentID {
			return apperror.Forbidden("you can only submit your own payment")
		}
		applicationID = app.ID
		return tx.SetSubmitted(ctx, paymentID, receiptFileURL)
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	s.notifyManagersNewPayment(ctx, updated, applicationID)
	return updated, nil
}

// Confirm is manager/admin-only. confirm marks the application 'settled';
// reject leaves the payment rejected so the student can resubmit.
func (s *PaymentService) Confirm(ctx context.Context, actorID, paymentID uuid.UUID, action string) (*domain.Payment, error) {
	var studentID, applicationID uuid.UUID

	err := s.payments.WithLock(ctx, paymentID, func(ctx context.Context, payment *domain.Payment, tx repository.PaymentTx) error {
		if payment.Status != domain.PaymentSubmitted {
			return apperror.Conflict("payment is not awaiting confirmation")
		}
		contract, err := s.contracts.GetByID(ctx, payment.ContractID)
		if err != nil {
			return err
		}
		app, err := s.applications.GetByID(ctx, contract.ApplicationID)
		if err != nil {
			return err
		}
		studentID = app.StudentID
		applicationID = app.ID

		switch action {
		case "confirm":
			if err := tx.SetDecision(ctx, paymentID, domain.PaymentConfirmed, actorID); err != nil {
				return err
			}
			return tx.MarkApplicationSettled(ctx, contract.ApplicationID, actorID)
		case "reject":
			return tx.SetDecision(ctx, paymentID, domain.PaymentRejected, actorID)
		default:
			return apperror.BadRequest("invalid action")
		}
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	s.notifyStudentPaymentDecision(ctx, studentID, applicationID, updated)
	return updated, nil
}

func (s *PaymentService) notifyManagersNewPayment(ctx context.Context, payment *domain.Payment, applicationID uuid.UUID) {
	body := fmt.Sprintf("Жаңа төлем (ID: %s) расталуын күтуде.", payment.ID)
	for _, role := range []domain.Role{domain.RoleAdmin, domain.RoleManager} {
		staff, err := s.users.ListByRole(ctx, role)
		if err != nil {
			continue
		}
		for _, u := range staff {
			_ = s.notifier.Notify(ctx, u.ID, domain.NotificationPaymentUpdate, "Жаңа төлем расталуын күтуде", body, &applicationID)
		}
	}
}

func (s *PaymentService) notifyStudentPaymentDecision(ctx context.Context, studentID, applicationID uuid.UUID, payment *domain.Payment) {
	title, body := "Төлем расталды", "Сіздің төлеміңіз расталды."
	if payment.Status == domain.PaymentRejected {
		title, body = "Төлем расталмады", "Сіздің төлеміңіз расталмады, чекті қайта жүктеңіз."
	}
	_ = s.notifier.Notify(ctx, studentID, domain.NotificationPaymentUpdate, title, body, &applicationID)
}
