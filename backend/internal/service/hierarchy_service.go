package service

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// HierarchyService manages the registry levels around a dormitory
// building: objects (the dormitory as an organisation, above) and floors
// (below), plus the full registry listing.
type HierarchyService struct {
	repo repository.HierarchyRepository
}

func NewHierarchyService(repo repository.HierarchyRepository) *HierarchyService {
	return &HierarchyService{repo: repo}
}

// ObjectInput is the "create/edit object" form.
type ObjectInput struct {
	Name          string
	OwnerName     *string
	BIN           *string
	OwnershipForm *string
	Phone         *string
}

// trimOptional trims s and turns "" into nil.
func trimOptional(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func optionalTooLong(s *string, max int) bool {
	return s != nil && utf8.RuneCountInString(*s) > max
}

func (in ObjectInput) toObject() (*domain.DormObject, error) {
	o := &domain.DormObject{
		Name:          strings.TrimSpace(in.Name),
		OwnerName:     trimOptional(in.OwnerName),
		BIN:           trimOptional(in.BIN),
		OwnershipForm: trimOptional(in.OwnershipForm),
		Phone:         trimOptional(in.Phone),
	}
	if o.Name == "" {
		return nil, apperror.BadRequest("объект атауы міндетті")
	}
	if utf8.RuneCountInString(o.Name) > 255 || optionalTooLong(o.OwnerName, 300) ||
		optionalTooLong(o.OwnershipForm, 100) || optionalTooLong(o.Phone, 50) {
		return nil, apperror.BadRequest("мәтін тым ұзын")
	}
	if o.BIN != nil {
		if len(*o.BIN) != 12 || strings.Trim(*o.BIN, "0123456789") != "" {
			return nil, apperror.BadRequest("БСН 12 цифрдан тұруы керек")
		}
	}
	return o, nil
}

const objectNameTakenMessage = "осындай атаулы объект бұрыннан бар"

func (s *HierarchyService) ListObjects(ctx context.Context) ([]*domain.DormObject, error) {
	return s.repo.ListObjects(ctx)
}

func (s *HierarchyService) GetObject(ctx context.Context, id uuid.UUID) (*domain.DormObject, error) {
	o, err := s.repo.GetObject(ctx, id)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, apperror.NotFound("объект табылмады")
	}
	return o, err
}

func (s *HierarchyService) CreateObject(ctx context.Context, in ObjectInput) (*domain.DormObject, error) {
	o, err := in.toObject()
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateObject(ctx, o); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict(objectNameTakenMessage)
		}
		return nil, err
	}
	return s.GetObject(ctx, o.ID)
}

func (s *HierarchyService) UpdateObject(ctx context.Context, id uuid.UUID, in ObjectInput) (*domain.DormObject, error) {
	o, err := in.toObject()
	if err != nil {
		return nil, err
	}
	o.ID = id
	if err := s.repo.UpdateObject(ctx, o); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict(objectNameTakenMessage)
		}
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("объект табылмады")
		}
		return nil, err
	}
	return s.GetObject(ctx, id)
}

func (s *HierarchyService) DeleteObject(ctx context.Context, id uuid.UUID) error {
	err := s.repo.DeleteObject(ctx, id)
	if errors.Is(err, repository.ErrNotEmpty) {
		return apperror.Conflict("объектте корпустар бар — алдымен оларды басқа объектіге ауыстырыңыз")
	}
	if errors.Is(err, repository.ErrNotFound) {
		return apperror.NotFound("объект табылмады")
	}
	return err
}

// MoveDormitories puts buildings into the object — this is how objects are
// merged. Objects left with no buildings are removed.
func (s *HierarchyService) MoveDormitories(ctx context.Context, objectID uuid.UUID, dormitoryIDs []uuid.UUID) (*domain.DormObject, error) {
	seen := make(map[uuid.UUID]bool, len(dormitoryIDs))
	ids := make([]uuid.UUID, 0, len(dormitoryIDs))
	for _, id := range dormitoryIDs {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return nil, apperror.BadRequest("кемінде бір корпусты таңдаңыз")
	}
	if err := s.repo.MoveDormitories(ctx, objectID, ids); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("объект немесе корпус табылмады")
		}
		return nil, err
	}
	return s.GetObject(ctx, objectID)
}

// FloorInput is the "add/edit floor" form.
type FloorInput struct {
	Number int
	Name   *string
}

func (in FloorInput) validate() error {
	if in.Number < -10 || in.Number > 200 {
		return apperror.BadRequest("қабат нөмірі -10 мен 200 аралығында болуы керек")
	}
	if optionalTooLong(in.Name, 100) {
		return apperror.BadRequest("мәтін тым ұзын")
	}
	return nil
}

const floorTakenMessage = "бұл корпуста осы нөмірлі қабат бұрыннан бар"

func (s *HierarchyService) ListFloors(ctx context.Context, dormitoryID uuid.UUID, includeRetired bool) ([]*domain.Floor, error) {
	return s.repo.ListFloors(ctx, dormitoryID, includeRetired)
}

func (s *HierarchyService) CreateFloor(ctx context.Context, dormitoryID uuid.UUID, in FloorInput) (*domain.Floor, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	number := in.Number
	f := &domain.Floor{DormitoryID: dormitoryID, Number: &number, Name: trimOptional(in.Name)}
	if err := s.repo.CreateFloor(ctx, f); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict(floorTakenMessage)
		}
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		return nil, err
	}
	return s.repo.GetFloor(ctx, f.ID)
}

func (s *HierarchyService) UpdateFloor(ctx context.Context, id uuid.UUID, in FloorInput) (*domain.Floor, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	number := in.Number
	f := &domain.Floor{ID: id, Number: &number, Name: trimOptional(in.Name)}
	if err := s.repo.UpdateFloor(ctx, f); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict(floorTakenMessage)
		}
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("қабат табылмады")
		}
		return nil, err
	}
	return s.repo.GetFloor(ctx, id)
}

func (s *HierarchyService) RetireFloor(ctx context.Context, id uuid.UUID) error {
	err := s.repo.RetireFloor(ctx, id)
	if errors.Is(err, repository.ErrNotEmpty) {
		return apperror.Conflict("қабатта бөлмелер бар — алдымен оларды басқа қабатқа ауыстырыңыз немесе өшіріңіз")
	}
	if errors.Is(err, repository.ErrNotFound) {
		return apperror.NotFound("қабат табылмады")
	}
	return err
}

// Registry tree: object → dormitory (корпус) → floor → room → bed.
type RegistryObject struct {
	ID            uuid.UUID
	Name          string
	OwnerName     *string
	OwnershipForm *string
	Dormitories   []*RegistryDormitory
}

type RegistryDormitory struct {
	ID      uuid.UUID
	Name    string
	Address string
	Floors  []*RegistryFloor
}

type RegistryFloor struct {
	ID     uuid.UUID
	Number *int
	Name   *string
	Rooms  []*RegistryRoom
}

type RegistryRoom struct {
	ID         uuid.UUID
	RoomNumber string
	Capacity   int
	Beds       []*RegistryBed
}

type RegistryBed struct {
	ID          uuid.UUID
	InventoryNo int64
	Label       string
	Occupied    bool
	Status      domain.BedStatus
	// ServiceReason / ServiceUntil are set while the bed is out of service.
	ServiceReason *string
	ServiceUntil  *time.Time
	// StatusChangedAt is when the bed's status last changed.
	StatusChangedAt *time.Time
}

// Registry builds the tree from the repository's ordered flat rows.
func (s *HierarchyService) Registry(ctx context.Context, objectID, dormitoryID *uuid.UUID) ([]*RegistryObject, error) {
	rows, err := s.repo.Registry(ctx, objectID, dormitoryID)
	if err != nil {
		return nil, err
	}
	out := []*RegistryObject{}
	var obj *RegistryObject
	var dorm *RegistryDormitory
	var floor *RegistryFloor
	var room *RegistryRoom
	for _, r := range rows {
		if obj == nil || obj.ID != r.ObjectID {
			obj = &RegistryObject{ID: r.ObjectID, Name: r.ObjectName, OwnerName: r.OwnerName,
				OwnershipForm: r.OwnershipForm, Dormitories: []*RegistryDormitory{}}
			out = append(out, obj)
			dorm = nil
		}
		if dorm == nil || dorm.ID != r.DormitoryID {
			dorm = &RegistryDormitory{ID: r.DormitoryID, Name: r.DormitoryName, Address: r.DormitoryAddress,
				Floors: []*RegistryFloor{}}
			obj.Dormitories = append(obj.Dormitories, dorm)
			floor = nil
		}
		if r.FloorID == nil {
			continue
		}
		if floor == nil || floor.ID != *r.FloorID {
			floor = &RegistryFloor{ID: *r.FloorID, Number: r.FloorNumber, Name: r.FloorName, Rooms: []*RegistryRoom{}}
			dorm.Floors = append(dorm.Floors, floor)
			room = nil
		}
		if r.RoomID == nil {
			continue
		}
		if room == nil || room.ID != *r.RoomID {
			room = &RegistryRoom{ID: *r.RoomID, RoomNumber: *r.RoomNumber, Capacity: *r.RoomCapacity, Beds: []*RegistryBed{}}
			floor.Rooms = append(floor.Rooms, room)
		}
		if r.BedID == nil {
			continue
		}
		room.Beds = append(room.Beds, &RegistryBed{ID: *r.BedID, InventoryNo: *r.BedInventoryNo,
			Label: *r.BedLabel, Occupied: r.BedOccupied,
			Status:        domain.BedStatusOf(r.BedOccupied, r.BedReserved, *r.BedService),
			ServiceReason: r.BedServiceReason, ServiceUntil: r.BedServiceUntil,
			StatusChangedAt: r.BedStatusChanged})
	}
	return out, nil
}
