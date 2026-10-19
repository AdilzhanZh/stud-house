package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// DocumentService manages the shared, reusable required-document catalog
// (see domain.RequiredDocument) that benefits and dormitories pick their
// required documents from.
type DocumentService struct {
	documents repository.RequiredDocumentRepository
}

func NewDocumentService(documents repository.RequiredDocumentRepository) *DocumentService {
	return &DocumentService{documents: documents}
}

func (s *DocumentService) Create(ctx context.Context, nameKk, nameRu string, validityDays *int) (*domain.RequiredDocument, error) {
	if nameKk == "" && nameRu == "" {
		return nil, apperror.BadRequest("құжат атауы міндетті")
	}
	if validityDays != nil && *validityDays <= 0 {
		return nil, apperror.BadRequest("жарамдылық мерзімі оң сан болуы керек")
	}
	// A name typed in only one language is shown as-is regardless of the
	// site's current locale, instead of falling back to an empty string.
	if nameKk == "" {
		nameKk = nameRu
	}
	if nameRu == "" {
		nameRu = nameKk
	}
	d := &domain.RequiredDocument{NameKk: nameKk, NameRu: nameRu, ValidityDays: validityDays}
	if err := s.documents.Create(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *DocumentService) List(ctx context.Context) ([]*domain.RequiredDocument, error) {
	return s.documents.List(ctx)
}

// SetValidityDays changes how long a required document stays valid after
// issue (nil = never expires). Already-uploaded documents are re-judged
// against it the next time their application is triaged.
func (s *DocumentService) SetValidityDays(ctx context.Context, id uuid.UUID, validityDays *int) error {
	if validityDays != nil && *validityDays <= 0 {
		return apperror.BadRequest("жарамдылық мерзімі оң сан болуы керек")
	}
	if err := s.documents.SetValidityDays(ctx, id, validityDays); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("құжат табылмады")
		}
		return err
	}
	return nil
}

func (s *DocumentService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.documents.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("құжат табылмады")
		}
		if errors.Is(err, repository.ErrConflict) {
			return apperror.Conflict("бұл құжат льгота немесе жатақханада қолданылып тұр, оны өшіру мүмкін емес")
		}
		return err
	}
	return nil
}
