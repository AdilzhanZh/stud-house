package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type DormitoryService struct {
	dormitories  repository.DormitoryRepository
	applications repository.ApplicationRepository
}

func NewDormitoryService(dormitories repository.DormitoryRepository, applications repository.ApplicationRepository) *DormitoryService {
	return &DormitoryService{dormitories: dormitories, applications: applications}
}

// DormitoryInput bundles the admin "create/edit dormitory" form fields
// (kept as a struct rather than growing the positional-arg list further).
type DormitoryInput struct {
	Name                    string
	Address                 string
	Phone                   *string
	Type                    *domain.DormitoryType
	FloorCount              *int
	TotalRoomsTarget        *int
	TotalCapacity           int
	RoomsMale               *int
	RoomsFemale             *int
	RoomsMixed              *int
	MonthlyPayment          *float64
	YearlyPayment           *float64
	BuiltYear               *time.Time
	CommissionedYear        *time.Time
	OwnershipForm           *string
	ClosedForApplications   bool
	DefaultReportTemplateID *uuid.UUID
}

func validateDormitoryInput(in DormitoryInput) error {
	if in.Name == "" || in.Address == "" {
		return apperror.BadRequest("атауы және мекенжайы міндетті")
	}
	if in.TotalCapacity < 0 {
		return apperror.BadRequest("жалпы сыйымдылық теріс сан бола алмайды")
	}
	if in.Type != nil {
		switch *in.Type {
		case domain.DormitorySectional, domain.DormitoryCorridor, domain.DormitoryBlock:
		default:
			return apperror.BadRequest("жатақхана түрі жарамсыз")
		}
	}
	if in.TotalRoomsTarget == nil {
		return apperror.BadRequest("жалпы бөлме санын енгізу міндетті")
	}
	if in.RoomsMale == nil || in.RoomsFemale == nil {
		return apperror.BadRequest("ерлерге және қыздарға арналған бөлме сандарын енгізу міндетті")
	}
	roomsSum := *in.RoomsMale + *in.RoomsFemale
	for _, c := range []*int{in.RoomsMale, in.RoomsFemale, in.RoomsMixed} {
		if c != nil && *c < 0 {
			return apperror.BadRequest("ерлерге/қыздарға/ортаққа арналған бөлме саны теріс сан бола алмайды")
		}
	}
	if in.RoomsMixed != nil {
		roomsSum += *in.RoomsMixed
	}
	if roomsSum != *in.TotalRoomsTarget {
		return apperror.BadRequest("ерлерге, қыздарға және ортаққа арналған бөлмелер қосындысы жалпы бөлме санына тең болуы керек")
	}
	return nil
}

func dormitoryFromInput(in DormitoryInput) *domain.Dormitory {
	return &domain.Dormitory{
		Name:                    in.Name,
		Address:                 in.Address,
		Phone:                   in.Phone,
		Type:                    in.Type,
		FloorCount:              in.FloorCount,
		TotalRoomsTarget:        in.TotalRoomsTarget,
		TotalCapacity:           in.TotalCapacity,
		RoomsMale:               in.RoomsMale,
		RoomsFemale:             in.RoomsFemale,
		RoomsMixed:              in.RoomsMixed,
		MonthlyPayment:          in.MonthlyPayment,
		YearlyPayment:           in.YearlyPayment,
		BuiltYear:               in.BuiltYear,
		CommissionedYear:        in.CommissionedYear,
		OwnershipForm:           in.OwnershipForm,
		ClosedForApplications:   in.ClosedForApplications,
		DefaultReportTemplateID: in.DefaultReportTemplateID,
	}
}

func (s *DormitoryService) Create(ctx context.Context, in DormitoryInput, createdBy uuid.UUID) (*domain.Dormitory, error) {
	if err := validateDormitoryInput(in); err != nil {
		return nil, err
	}
	d := dormitoryFromInput(in)
	d.CreatedBy = createdBy
	if err := s.dormitories.Create(ctx, d); err != nil {
		if errors.Is(err, repository.ErrInvalidReference) {
			return nil, apperror.BadRequest("әдепкі хаттама шаблоны табылмады")
		}
		return nil, err
	}
	return d, nil
}

func (s *DormitoryService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Dormitory, error) {
	d, err := s.dormitories.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		return nil, err
	}
	return d, nil
}

func (s *DormitoryService) List(ctx context.Context, openOnly bool) ([]*domain.Dormitory, error) {
	return s.dormitories.List(ctx, openOnly)
}

func (s *DormitoryService) Update(ctx context.Context, id uuid.UUID, in DormitoryInput) (*domain.Dormitory, error) {
	if err := validateDormitoryInput(in); err != nil {
		return nil, err
	}
	d := dormitoryFromInput(in)
	d.ID = id
	if err := s.dormitories.Update(ctx, d); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		if errors.Is(err, repository.ErrInvalidReference) {
			return nil, apperror.BadRequest("әдепкі хаттама шаблоны табылмады")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// Delete refuses to remove a dormitory that still has a non-rejected
// application attached (pending/manager_review/needs_correction/approved/
// settled) — the student's application is still in play. Applications that
// were already rejected carry no such claim, so they're deleted along with
// the dormitory rather than blocking removal.
func (s *DormitoryService) Delete(ctx context.Context, id uuid.UUID) error {
	apps, err := s.applications.ListByDormitory(ctx, id)
	if err != nil {
		return err
	}
	for _, app := range apps {
		if app.Status != domain.ApplicationRejected {
			return apperror.Conflict("бұл жатақханаға белсенді өтініштер тіркелген, оны өшіру мүмкін емес")
		}
	}
	for _, app := range apps {
		if err := s.applications.Delete(ctx, app.ID); err != nil {
			if errors.Is(err, repository.ErrConflict) {
				return apperror.Conflict("бұл жатақханаға тіркелген өтініштер басқа жазбамен байланысты, оны өшіру мүмкін емес")
			}
			if !errors.Is(err, repository.ErrNotFound) {
				return err
			}
		}
	}

	if err := s.dormitories.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("жатақхана табылмады")
		}
		if errors.Is(err, repository.ErrConflict) {
			return apperror.Conflict("бұл жатақханаға өтініштер тіркелген, оны өшіру мүмкін емес")
		}
		return err
	}
	return nil
}

func (s *DormitoryService) GetCapacity(ctx context.Context, id uuid.UUID) (*domain.DormitoryCapacity, error) {
	c, err := s.dormitories.GetCapacity(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		return nil, err
	}
	return c, nil
}

func (s *DormitoryService) AddImage(ctx context.Context, dormitoryID uuid.UUID, imageURL string) (*domain.DormitoryImage, error) {
	if imageURL == "" {
		return nil, apperror.BadRequest("сурет сілтемесі міндетті")
	}
	if _, err := s.GetByID(ctx, dormitoryID); err != nil {
		return nil, err
	}
	img := &domain.DormitoryImage{DormitoryID: dormitoryID, ImageURL: imageURL}
	if err := s.dormitories.AddImage(ctx, img); err != nil {
		return nil, err
	}
	return img, nil
}

func (s *DormitoryService) ListImages(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryImage, error) {
	return s.dormitories.ListImages(ctx, dormitoryID)
}

func (s *DormitoryService) DeleteImage(ctx context.Context, imageID uuid.UUID) error {
	if err := s.dormitories.DeleteImage(ctx, imageID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("сурет табылмады")
		}
		return err
	}
	return nil
}

func (s *DormitoryService) AddRequiredDocument(ctx context.Context, dormitoryID, documentID uuid.UUID) (*domain.DormitoryRequiredDocument, error) {
	if _, err := s.GetByID(ctx, dormitoryID); err != nil {
		return nil, err
	}
	d := &domain.DormitoryRequiredDocument{DormitoryID: dormitoryID, DocumentID: documentID}
	if err := s.dormitories.AddRequiredDocument(ctx, d); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.BadRequest("құжат каталогта табылмады")
		}
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("бұл құжат жатақханаға бұрын қосылған")
		}
		return nil, err
	}
	return d, nil
}

func (s *DormitoryService) ListRequiredDocuments(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryRequiredDocument, error) {
	return s.dormitories.ListRequiredDocuments(ctx, dormitoryID)
}

func (s *DormitoryService) DeleteRequiredDocument(ctx context.Context, docID uuid.UUID) error {
	if err := s.dormitories.DeleteRequiredDocument(ctx, docID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("қажетті құжат табылмады")
		}
		return err
	}
	return nil
}
