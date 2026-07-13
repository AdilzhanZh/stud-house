package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

const paymentVoidedComment = "Төлем мерзімде расталмағандықтан менеджер өтінішті жойды"

type PaymentService struct {
	payments     repository.PaymentRepository
	contracts    repository.ContractRepository
	applications repository.ApplicationRepository
	users        repository.UserRepository
	notifier     *notifier.Notifier
	// reminderWindow: managers get reminded about a pending/submitted
	// payment once its deadline is within this window.
	reminderWindow time.Duration
	// reapplyBlock is how long a student is barred from submitting a new
	// application after ManagerDecision(action="void") voids one of their
	// overdue payments.
	reapplyBlock time.Duration
}

func NewPaymentService(
	payments repository.PaymentRepository,
	contracts repository.ContractRepository,
	applications repository.ApplicationRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
	reminderWindow time.Duration,
	reapplyBlock time.Duration,
) *PaymentService {
	return &PaymentService{
		payments:       payments,
		contracts:      contracts,
		applications:   applications,
		users:          users,
		notifier:       notifier,
		reminderWindow: reminderWindow,
		reapplyBlock:   reapplyBlock,
	}
}

func (s *PaymentService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Payment, error) {
	p, err := s.payments.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("төлем табылмады")
		}
		return nil, err
	}
	return p, nil
}

// List is manager/admin-only: the payment review queue, optionally
// filtered by status (e.g. ?status=submitted).
func (s *PaymentService) List(ctx context.Context, status *domain.PaymentStatus) ([]*domain.Payment, error) {
	return s.payments.List(ctx, status)
}

func (s *PaymentService) GetByContractID(ctx context.Context, contractID uuid.UUID) (*domain.Payment, error) {
	p, err := s.payments.GetByContractID(ctx, contractID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("бұл келісімшарт бойынша төлем табылмады")
		}
		return nil, err
	}
	return p, nil
}

// ListMine is student-only: every payment tied to one of the caller's own
// contracts (frontend kezeng 3: /payments/my).
func (s *PaymentService) ListMine(ctx context.Context, studentID uuid.UUID) ([]*domain.Payment, error) {
	return s.payments.ListByStudent(ctx, studentID)
}

// Submit lets the owning student attach a receipt while the contract is
// accepted; it may be called again after a rejection to resubmit.
func (s *PaymentService) Submit(ctx context.Context, actorStudentID, paymentID uuid.UUID, receiptFileURL string) (*domain.Payment, error) {
	if receiptFileURL == "" {
		return nil, apperror.BadRequest("чек файлының сілтемесі міндетті")
	}

	var applicationID uuid.UUID
	err := s.payments.WithLock(ctx, paymentID, func(ctx context.Context, payment *domain.Payment, tx repository.PaymentTx) error {
		if payment.Status == domain.PaymentConfirmed {
			return apperror.Conflict("төлем бұрын расталған")
		}
		contract, err := s.contracts.GetByID(ctx, payment.ContractID)
		if err != nil {
			return err
		}
		if contract.Status != domain.ContractAccepted {
			return apperror.Conflict("келісімшарт қабылданбаған")
		}
		app, err := s.applications.GetByID(ctx, contract.ApplicationID)
		if err != nil {
			return err
		}
		if app.StudentID != actorStudentID {
			return apperror.Forbidden("тек өз төлеміңізді жібере аласыз")
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
// reject leaves the payment rejected so the student can resubmit. Allowed
// from both 'pending' and 'submitted' — a manager may confirm a payment
// made in person at the accounting office (rooms 212/315) before or
// without the student ever submitting a receipt through the site.
func (s *PaymentService) Confirm(ctx context.Context, actorID, paymentID uuid.UUID, action string) (*domain.Payment, error) {
	var studentID, applicationID uuid.UUID

	err := s.payments.WithLock(ctx, paymentID, func(ctx context.Context, payment *domain.Payment, tx repository.PaymentTx) error {
		if payment.Status != domain.PaymentPending && payment.Status != domain.PaymentSubmitted {
			return apperror.Conflict("төлем растауды күтіп тұрған жоқ")
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
			return apperror.BadRequest("әрекет жарамсыз")
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

// FlagOverduePayments finds every 'pending'/'submitted' payment past its
// deadline and moves it to 'awaiting_manager_decision'. It does NOT touch
// the application or room_residents — per the same spec fix already applied
// to contracts (ContractService.FlagOverdueContracts), expiring a payment
// (rejecting the application, freeing the room, blocking reapplication)
// only happens through a manager's explicit ManagerDecision(action="void").
// Safe to call repeatedly (from a ticker or manually via
// POST /admin/payments/expire-check).
func (s *PaymentService) FlagOverduePayments(ctx context.Context) (int, error) {
	overdue, err := s.payments.ListExpiredPending(ctx, time.Now())
	if err != nil {
		return 0, err
	}

	count := 0
	for _, payment := range overdue {
		err := s.payments.WithLock(ctx, payment.ID, func(ctx context.Context, p *domain.Payment, tx repository.PaymentTx) error {
			if (p.Status != domain.PaymentPending && p.Status != domain.PaymentSubmitted) || !time.Now().After(p.Deadline) {
				return nil
			}
			return tx.SetStatus(ctx, p.ID, domain.PaymentAwaitingManagerDecision)
		})
		if err != nil {
			log.Printf("failed to flag overdue payment %s: %v", payment.ID, err)
			continue
		}
		count++
	}
	return count, nil
}

// RemindApproachingPaymentDeadline notifies every admin/manager about
// pending/submitted payments whose deadline is within reminderWindow, at
// most once per payment (reminder_sent_at).
func (s *PaymentService) RemindApproachingPaymentDeadline(ctx context.Context) (int, error) {
	now := time.Now()
	approaching, err := s.payments.ListApproachingDeadline(ctx, now, now.Add(s.reminderWindow))
	if err != nil {
		return 0, err
	}

	count := 0
	for _, payment := range approaching {
		body := fmt.Sprintf("Төлем (ID: %s) мерзімі жақындап қалды, растаңыз немесе қабылдамаңыз.", payment.ID)
		for _, role := range []domain.Role{domain.RoleAdmin, domain.RoleManager} {
			staff, err := s.users.ListByRole(ctx, role)
			if err != nil {
				continue
			}
			for _, u := range staff {
				_ = s.notifier.Notify(ctx, u.ID, domain.NotificationPaymentUpdate, "Төлем мерзімі жақындап қалды", body, nil)
			}
		}
		if err := s.payments.MarkReminderSent(ctx, payment.ID); err != nil {
			log.Printf("failed to mark reminder sent for payment %s: %v", payment.ID, err)
			continue
		}
		count++
	}
	return count, nil
}

// ManagerDecision is the only way a payment past its deadline can actually
// be resolved: void rejects the underlying application, frees the room, and
// bars the student from submitting a new application for reapplyBlock;
// extend gives the payment a fresh deadline.
func (s *PaymentService) ManagerDecision(ctx context.Context, actorID, paymentID uuid.UUID, action string, newDeadline *time.Time) (*domain.Payment, error) {
	var studentID, applicationID uuid.UUID

	err := s.payments.WithLock(ctx, paymentID, func(ctx context.Context, payment *domain.Payment, tx repository.PaymentTx) error {
		if payment.Status != domain.PaymentAwaitingManagerDecision {
			return apperror.Conflict("төлем менеджердің шешімін күтіп тұрған жоқ")
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
		case "void":
			if err := tx.SetStatus(ctx, paymentID, domain.PaymentRejected); err != nil {
				return err
			}
			if err := tx.MarkApplicationRejected(ctx, contract.ApplicationID, paymentVoidedComment, actorID); err != nil {
				return err
			}
			if err := tx.FreeActiveRoomResident(ctx, app.StudentID); err != nil {
				return err
			}
			return s.applications.SetReapplyBlock(ctx, app.StudentID, time.Now().Add(s.reapplyBlock))
		case "extend":
			if newDeadline == nil {
				return apperror.BadRequest("ұзарту үшін жаңа мерзім міндетті")
			}
			if !newDeadline.After(time.Now()) {
				return apperror.BadRequest("жаңа мерзім болашақта болуы керек")
			}
			return tx.Extend(ctx, paymentID, *newDeadline)
		default:
			return apperror.BadRequest("әрекет жарамсыз")
		}
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	s.notifyManagerDecision(ctx, studentID, applicationID, updated)
	return updated, nil
}

func (s *PaymentService) notifyManagerDecision(ctx context.Context, studentID, applicationID uuid.UUID, payment *domain.Payment) {
	title, body := "Төлем мерзімі ұзартылды", fmt.Sprintf("Сіздің төлеміңіздің мерзімі ұзартылды: %s дейін.", payment.Deadline.Format(time.RFC3339))
	if payment.Status == domain.PaymentRejected {
		title, body = "Өтініш жойылды", fmt.Sprintf("Сіз төлемді мерзімде растатпағандықтан, менеджер өтінішіңізді жойды. Сіз %s дейін жаңа өтініш бере алмайсыз.", time.Now().Add(s.reapplyBlock).Format("2006-01-02"))
	}
	_ = s.notifier.Notify(ctx, studentID, domain.NotificationPaymentUpdate, title, body, &applicationID)
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
