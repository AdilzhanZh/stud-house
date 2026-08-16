package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type BenefitService struct {
	benefits repository.BenefitRepository
	users    repository.UserRepository
	assigns  repository.StudentBenefitRepository
}

func NewBenefitService(benefits repository.BenefitRepository, users repository.UserRepository, assigns repository.StudentBenefitRepository) *BenefitService {
	return &BenefitService{benefits: benefits, users: users, assigns: assigns}
}

func validateBenefitPriority(priority int) error {
	if priority < 1 || priority > 10 {
		return apperror.BadRequest("приоритет салмағы 1 мен 10 аралығында болуы керек")
	}
	return nil
}

// fallbackBilingual fills an empty side of a bilingual pair from the other
// side, so an entry typed in only one language still shows for both locales
// instead of appearing blank when the site is switched.
func fallbackBilingual(kk, ru string) (string, string) {
	if kk == "" {
		kk = ru
	}
	if ru == "" {
		ru = kk
	}
	return kk, ru
}

func (s *BenefitService) Create(ctx context.Context, nameKk, nameRu, descriptionKk, descriptionRu string, priority int, createdBy uuid.UUID) (*domain.Benefit, error) {
	if nameKk == "" && nameRu == "" {
		return nil, apperror.BadRequest("атауы міндетті")
	}
	if err := validateBenefitPriority(priority); err != nil {
		return nil, err
	}
	nameKk, nameRu = fallbackBilingual(nameKk, nameRu)
	descriptionKk, descriptionRu = fallbackBilingual(descriptionKk, descriptionRu)
	b := &domain.Benefit{
		NameKk: nameKk, NameRu: nameRu,
		DescriptionKk: descriptionKk, DescriptionRu: descriptionRu,
		Priority: priority, CreatedBy: createdBy,
	}
	if err := s.benefits.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *BenefitService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Benefit, error) {
	b, err := s.benefits.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("льгота табылмады")
		}
		return nil, err
	}
	return b, nil
}

func (s *BenefitService) List(ctx context.Context) ([]*domain.Benefit, error) {
	return s.benefits.List(ctx)
}

func (s *BenefitService) Update(ctx context.Context, id uuid.UUID, nameKk, nameRu, descriptionKk, descriptionRu string, priority int) (*domain.Benefit, error) {
	if nameKk == "" && nameRu == "" {
		return nil, apperror.BadRequest("атауы міндетті")
	}
	if err := validateBenefitPriority(priority); err != nil {
		return nil, err
	}
	nameKk, nameRu = fallbackBilingual(nameKk, nameRu)
	descriptionKk, descriptionRu = fallbackBilingual(descriptionKk, descriptionRu)
	b := &domain.Benefit{
		ID: id, NameKk: nameKk, NameRu: nameRu,
		DescriptionKk: descriptionKk, DescriptionRu: descriptionRu,
		Priority: priority,
	}
	if err := s.benefits.Update(ctx, b); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("льгота табылмады")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *BenefitService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.benefits.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("льгота табылмады")
		}
		return err
	}
	return nil
}

func (s *BenefitService) AddRequiredDocument(ctx context.Context, benefitID, documentID uuid.UUID) (*domain.BenefitRequiredDocument, error) {
	if _, err := s.GetByID(ctx, benefitID); err != nil {
		return nil, err
	}
	d := &domain.BenefitRequiredDocument{BenefitID: benefitID, DocumentID: documentID}
	if err := s.benefits.AddRequiredDocument(ctx, d); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.BadRequest("құжат каталогта табылмады")
		}
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("бұл құжат льготаға бұрын қосылған")
		}
		return nil, err
	}
	return d, nil
}

func (s *BenefitService) ListRequiredDocuments(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitRequiredDocument, error) {
	return s.benefits.ListRequiredDocuments(ctx, benefitID)
}

func (s *BenefitService) DeleteRequiredDocument(ctx context.Context, docID uuid.UUID) error {
	if err := s.benefits.DeleteRequiredDocument(ctx, docID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("қажетті құжат табылмады")
		}
		return err
	}
	return nil
}

// AssignBenefit records that a student holds a benefit; this is a minimal
// assignment used by room restriction validation, not the full application
// workflow (out of scope for this phase).
func (s *BenefitService) AssignBenefit(ctx context.Context, studentID, benefitID, assignedBy uuid.UUID) (*domain.StudentBenefit, error) {
	student, err := s.users.GetByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("студент табылмады")
		}
		return nil, err
	}
	if student.Role != domain.RoleStudent {
		return nil, apperror.BadRequest("льготаны тек студент рөліндегі пайдаланушыға тағайындауға болады")
	}
	if _, err := s.GetByID(ctx, benefitID); err != nil {
		return nil, err
	}

	sb := &domain.StudentBenefit{StudentID: studentID, BenefitID: benefitID, AssignedBy: assignedBy}
	if err := s.assigns.Assign(ctx, sb); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("студентте бұл льгота бұрыннан бар")
		}
		return nil, err
	}
	return sb, nil
}

func (s *BenefitService) ListStudentBenefits(ctx context.Context, studentID uuid.UUID) ([]*domain.StudentBenefit, error) {
	return s.assigns.ListByStudent(ctx, studentID)
}

func (s *BenefitService) RevokeBenefit(ctx context.Context, studentID, benefitID uuid.UUID) error {
	if err := s.assigns.Revoke(ctx, studentID, benefitID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("студентте бұл льгота жоқ")
		}
		return err
	}
	return nil
}
