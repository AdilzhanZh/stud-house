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

func (s *BenefitService) Create(ctx context.Context, name, description string, createdBy uuid.UUID) (*domain.Benefit, error) {
	if name == "" {
		return nil, apperror.BadRequest("name is required")
	}
	b := &domain.Benefit{Name: name, Description: description, CreatedBy: createdBy}
	if err := s.benefits.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *BenefitService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Benefit, error) {
	b, err := s.benefits.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("benefit not found")
		}
		return nil, err
	}
	return b, nil
}

func (s *BenefitService) List(ctx context.Context) ([]*domain.Benefit, error) {
	return s.benefits.List(ctx)
}

func (s *BenefitService) Update(ctx context.Context, id uuid.UUID, name, description string) (*domain.Benefit, error) {
	if name == "" {
		return nil, apperror.BadRequest("name is required")
	}
	b := &domain.Benefit{ID: id, Name: name, Description: description}
	if err := s.benefits.Update(ctx, b); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("benefit not found")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *BenefitService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.benefits.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("benefit not found")
		}
		return err
	}
	return nil
}

func (s *BenefitService) AddField(ctx context.Context, benefitID uuid.UUID, fieldName, fieldType string) (*domain.BenefitField, error) {
	if fieldName == "" || fieldType == "" {
		return nil, apperror.BadRequest("field_name and field_type are required")
	}
	if _, err := s.GetByID(ctx, benefitID); err != nil {
		return nil, err
	}
	f := &domain.BenefitField{BenefitID: benefitID, FieldName: fieldName, FieldType: fieldType}
	if err := s.benefits.AddField(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *BenefitService) ListFields(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitField, error) {
	return s.benefits.ListFields(ctx, benefitID)
}

func (s *BenefitService) DeleteField(ctx context.Context, fieldID uuid.UUID) error {
	if err := s.benefits.DeleteField(ctx, fieldID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("field not found")
		}
		return err
	}
	return nil
}

func (s *BenefitService) AddRequiredDocument(ctx context.Context, benefitID uuid.UUID, documentName string) (*domain.BenefitRequiredDocument, error) {
	if documentName == "" {
		return nil, apperror.BadRequest("document_name is required")
	}
	if _, err := s.GetByID(ctx, benefitID); err != nil {
		return nil, err
	}
	d := &domain.BenefitRequiredDocument{BenefitID: benefitID, DocumentName: documentName}
	if err := s.benefits.AddRequiredDocument(ctx, d); err != nil {
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
			return apperror.NotFound("required document not found")
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
			return nil, apperror.NotFound("student not found")
		}
		return nil, err
	}
	if student.Role != domain.RoleStudent {
		return nil, apperror.BadRequest("benefits can only be assigned to users with role=student")
	}
	if _, err := s.GetByID(ctx, benefitID); err != nil {
		return nil, err
	}

	sb := &domain.StudentBenefit{StudentID: studentID, BenefitID: benefitID, AssignedBy: assignedBy}
	if err := s.assigns.Assign(ctx, sb); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("student already has this benefit")
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
			return apperror.NotFound("student does not have this benefit")
		}
		return err
	}
	return nil
}
