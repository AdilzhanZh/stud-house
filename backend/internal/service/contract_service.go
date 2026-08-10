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

const contractDeclinedComment = "Студент келісімшартты қабылдамады"
const contractVoidedComment = "Мерзімде жауап бермегендіктен менеджер өтінішті жойды"

type ContractService struct {
	contracts        repository.ContractRepository
	applications     repository.ApplicationRepository
	protocols        repository.ProtocolRepository
	users            repository.UserRepository
	notifier         *notifier.Notifier
	responseDeadline time.Duration
	reminderWindow   time.Duration
}

func NewContractService(
	contracts repository.ContractRepository,
	applications repository.ApplicationRepository,
	protocols repository.ProtocolRepository,
	users repository.UserRepository,
	notifier *notifier.Notifier,
	responseDeadline time.Duration,
	reminderWindow time.Duration,
) *ContractService {
	return &ContractService{
		contracts:        contracts,
		applications:     applications,
		protocols:        protocols,
		users:            users,
		notifier:         notifier,
		responseDeadline: responseDeadline,
		reminderWindow:   reminderWindow,
	}
}

// OnProtocolApproved is wired as ProtocolService's onApproved hook: it
// creates one contract per application in the protocol (idempotent — skips
// any application that already has one) and notifies each student.
func (s *ContractService) OnProtocolApproved(ctx context.Context, protocolID uuid.UUID) error {
	appIDs, err := s.protocols.ListApplicationIDs(ctx, protocolID)
	if err != nil {
		return err
	}

	// The protocol template has no attachable file — a contract's "Open PDF"
	// link starts empty, hidden by the frontend when file_url is empty.
	var contractFileURL string

	now := time.Now()
	for _, appID := range appIDs {
		contract := &domain.Contract{
			ApplicationID:    appID,
			FileURL:          contractFileURL,
			Status:           domain.ContractSent,
			SentAt:           now,
			ResponseDeadline: now.Add(s.responseDeadline),
		}
		created, err := s.contracts.CreateIfNotExists(ctx, contract)
		if err != nil {
			log.Printf("failed to create contract for application %s: %v", appID, err)
			continue
		}
		if !created {
			continue
		}

		app, err := s.applications.GetByID(ctx, appID)
		if err != nil {
			log.Printf("contract created but failed to load application %s for notification: %v", appID, err)
			continue
		}
		body := fmt.Sprintf("Сізге келісімшарт жіберілді, %d күн ішінде растаңыз.", int(s.responseDeadline.Hours()/24))
		_ = s.notifier.Notify(ctx, app.StudentID, domain.NotificationContractSent, "Келісімшарт жіберілді", body, &app.ID)
	}
	return nil
}

func (s *ContractService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Contract, error) {
	c, err := s.contracts.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("келісімшарт табылмады")
		}
		return nil, err
	}
	return c, nil
}

func (s *ContractService) GetByApplicationID(ctx context.Context, applicationID uuid.UUID) (*domain.Contract, error) {
	c, err := s.contracts.GetByApplicationID(ctx, applicationID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("бұл өтініш бойынша келісімшарт табылмады")
		}
		return nil, err
	}
	return c, nil
}

// Respond lets the owning student accept or decline a contract while it is
// still 'sent' and before its deadline. accept settles the underlying
// application immediately — there is no separate payment-confirmation step;
// decline rejects the underlying application and frees the student's room.
func (s *ContractService) Respond(ctx context.Context, actorStudentID, contractID uuid.UUID, action string) (*domain.Contract, error) {
	err := s.contracts.WithLock(ctx, contractID, func(ctx context.Context, contract *domain.Contract, tx repository.ContractTx) error {
		app, err := s.applications.GetByID(ctx, contract.ApplicationID)
		if err != nil {
			return err
		}
		if app.StudentID != actorStudentID {
			return apperror.Forbidden("тек өз келісімшартыңызға жауап бере аласыз")
		}
		if contract.Status != domain.ContractSent {
			return apperror.Conflict("келісімшартқа жауап бұрын берілген немесе ол енді белсенді емес")
		}
		if time.Now().After(contract.ResponseDeadline) {
			// Lazily flag it rather than deciding anything ourselves — per
			// spec, only a manager may void/extend a contract past its
			// deadline (see ManagerDecision).
			_ = tx.SetStatus(ctx, contractID, domain.ContractAwaitingManagerDecision, nil)
			return apperror.Conflict("жауап беру мерзімі өтті, менеджердің шешімі күтілуде")
		}

		now := time.Now()
		switch action {
		case "accept":
			if err := tx.SetStatus(ctx, contractID, domain.ContractAccepted, &now); err != nil {
				return err
			}
			return tx.MarkApplicationSettled(ctx, contract.ApplicationID, actorStudentID)
		case "decline":
			if err := tx.SetStatus(ctx, contractID, domain.ContractDeclined, &now); err != nil {
				return err
			}
			if err := tx.MarkApplicationRejected(ctx, contract.ApplicationID, contractDeclinedComment, actorStudentID); err != nil {
				return err
			}
			return tx.FreeActiveRoomResident(ctx, actorStudentID)
		default:
			return apperror.BadRequest("әрекет жарамсыз")
		}
	})
	if err != nil {
		return nil, err
	}
	return s.GetByID(ctx, contractID)
}

// FlagOverdueContracts finds every 'sent' contract past its
// response_deadline and moves it to 'awaiting_manager_decision'. It does
// NOT touch the application or room_residents — per spec, expiring a
// contract (rejecting the application, freeing the room) only happens
// through a manager's explicit ManagerDecision(action="void"). Safe to call
// repeatedly (from a ticker or manually via POST /admin/contracts/expire-check).
func (s *ContractService) FlagOverdueContracts(ctx context.Context) (int, error) {
	overdue, err := s.contracts.ListExpiredSent(ctx, time.Now())
	if err != nil {
		return 0, err
	}

	count := 0
	for _, contract := range overdue {
		err := s.contracts.WithLock(ctx, contract.ID, func(ctx context.Context, c *domain.Contract, tx repository.ContractTx) error {
			if c.Status != domain.ContractSent || !time.Now().After(c.ResponseDeadline) {
				return nil
			}
			return tx.SetStatus(ctx, c.ID, domain.ContractAwaitingManagerDecision, nil)
		})
		if err != nil {
			log.Printf("failed to flag overdue contract %s: %v", contract.ID, err)
			continue
		}
		count++
	}
	return count, nil
}

// RemindApproachingDeadline notifies every admin/manager about 'sent'
// contracts whose deadline is within reminderWindow, at most once per
// contract (reminder_sent_at).
func (s *ContractService) RemindApproachingDeadline(ctx context.Context) (int, error) {
	now := time.Now()
	approaching, err := s.contracts.ListApproachingDeadline(ctx, now, now.Add(s.reminderWindow))
	if err != nil {
		return 0, err
	}

	count := 0
	for _, contract := range approaching {
		app, err := s.applications.GetByID(ctx, contract.ApplicationID)
		if err != nil {
			log.Printf("failed to load application for reminder on contract %s: %v", contract.ID, err)
			continue
		}
		body := fmt.Sprintf("Студент (ID: %s) әлі келісімшартқа жауап бермеді, мерзімі %s жақындап қалды.", app.StudentID, contract.ResponseDeadline.Format(time.RFC3339))
		for _, role := range []domain.Role{domain.RoleAdmin, domain.RoleManager} {
			staff, err := s.users.ListByRole(ctx, role)
			if err != nil {
				continue
			}
			for _, u := range staff {
				_ = s.notifier.Notify(ctx, u.ID, domain.NotificationContractSent, "Келісімшарт мерзімі жақындап қалды", body, &app.ID)
			}
		}
		if err := s.contracts.MarkReminderSent(ctx, contract.ID); err != nil {
			log.Printf("failed to mark reminder sent for contract %s: %v", contract.ID, err)
			continue
		}
		count++
	}
	return count, nil
}

func (s *ContractService) List(ctx context.Context, status *domain.ContractStatus) ([]*domain.Contract, error) {
	return s.contracts.List(ctx, status)
}

// ListMine is student-only: every contract tied to one of the caller's own
// applications (frontend kezeng 3: /contracts/my).
func (s *ContractService) ListMine(ctx context.Context, studentID uuid.UUID) ([]*domain.Contract, error) {
	return s.contracts.ListByStudent(ctx, studentID)
}

// ManagerDecision is the only way a contract past its deadline can actually
// be resolved: void rejects the application and frees the room (same
// effect phase 4 wrongly applied automatically); extend gives the student a
// fresh deadline.
func (s *ContractService) ManagerDecision(ctx context.Context, actorID, contractID uuid.UUID, action string, newDeadline *time.Time) (*domain.Contract, error) {
	err := s.contracts.WithLock(ctx, contractID, func(ctx context.Context, contract *domain.Contract, tx repository.ContractTx) error {
		if contract.Status != domain.ContractAwaitingManagerDecision {
			return apperror.Conflict("келісімшарт менеджердің шешімін күтіп тұрған жоқ")
		}
		switch action {
		case "void":
			if err := tx.SetStatus(ctx, contractID, domain.ContractExpired, nil); err != nil {
				return err
			}
			if err := tx.MarkApplicationRejected(ctx, contract.ApplicationID, contractVoidedComment, actorID); err != nil {
				return err
			}
			app, err := s.applications.GetByID(ctx, contract.ApplicationID)
			if err != nil {
				return err
			}
			return tx.FreeActiveRoomResident(ctx, app.StudentID)
		case "extend":
			if newDeadline == nil {
				return apperror.BadRequest("ұзарту үшін жаңа мерзім міндетті")
			}
			if !newDeadline.After(time.Now()) {
				return apperror.BadRequest("жаңа мерзім болашақта болуы керек")
			}
			return tx.Extend(ctx, contractID, *newDeadline)
		default:
			return apperror.BadRequest("әрекет жарамсыз")
		}
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, contractID)
	if err != nil {
		return nil, err
	}
	s.notifyManagerDecision(ctx, updated)
	return updated, nil
}

func (s *ContractService) notifyManagerDecision(ctx context.Context, contract *domain.Contract) {
	app, err := s.applications.GetByID(ctx, contract.ApplicationID)
	if err != nil {
		return
	}
	title, body := "Келісімшарт мерзімі ұзартылды", fmt.Sprintf("Сіздің келісімшартыңыздың жауап беру мерзімі ұзартылды: %s дейін.", contract.ResponseDeadline.Format(time.RFC3339))
	if contract.Status == domain.ContractExpired {
		title, body = "Келісімшарт жойылды", "Сіз мерзімде жауап бермегендіктен, менеджер өтінішіңізді жойды."
	}
	_ = s.notifier.Notify(ctx, app.StudentID, domain.NotificationContractSent, title, body, &app.ID)
}
