package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type RoomService struct {
	rooms           repository.RoomRepository
	dormitories     repository.DormitoryRepository
	users           repository.UserRepository
	profiles        repository.StudentProfileRepository
	studentBenefits repository.StudentBenefitRepository
}

func NewRoomService(
	rooms repository.RoomRepository,
	dormitories repository.DormitoryRepository,
	users repository.UserRepository,
	profiles repository.StudentProfileRepository,
	studentBenefits repository.StudentBenefitRepository,
) *RoomService {
	return &RoomService{
		rooms:           rooms,
		dormitories:     dormitories,
		users:           users,
		profiles:        profiles,
		studentBenefits: studentBenefits,
	}
}

// RoomInput bundles the admin "create/edit room" form fields.
type RoomInput struct {
	RoomNumber string
	Capacity   int
	Floor      *int
	Category   string
	AreaSqM    *float64
	Equipment  *string
	TopBeds    int
	BottomBeds int
}

func validateBedLevels(in RoomInput) error {
	if in.TopBeds+in.BottomBeds != in.Capacity {
		return apperror.BadRequest("үстіңгі және астыңғы орын саны сыйымдылыққа тең болуы керек")
	}
	return nil
}

func (s *RoomService) Create(ctx context.Context, dormitoryID uuid.UUID, in RoomInput) (*domain.Room, error) {
	if in.RoomNumber == "" {
		return nil, apperror.BadRequest("бөлме нөмірі міндетті")
	}
	if in.Capacity <= 0 {
		return nil, apperror.BadRequest("сыйымдылық оң сан болуы керек")
	}
	if err := validateBedLevels(in); err != nil {
		return nil, err
	}
	if _, err := s.dormitories.GetByID(ctx, dormitoryID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		return nil, err
	}

	category := in.Category
	if category == "" {
		category = "general"
	}
	room := &domain.Room{
		DormitoryID: dormitoryID,
		RoomNumber:  in.RoomNumber,
		Capacity:    in.Capacity,
		Floor:       in.Floor,
		Category:    category,
		AreaSqM:     in.AreaSqM,
		Equipment:   in.Equipment,
		TopBeds:     in.TopBeds,
		BottomBeds:  in.BottomBeds,
	}
	if err := s.rooms.Create(ctx, room); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("бұл жатақханада осы нөмірлі бөлме бұрыннан бар")
		}
		return nil, err
	}
	return room, nil
}

func (s *RoomService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Room, error) {
	room, err := s.rooms.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("бөлме табылмады")
		}
		return nil, err
	}
	return room, nil
}

// GetActiveResidence is student-facing (frontend kezeng 3: "Менің
// орналасуым"): there was previously no way for a student to discover which
// room they currently live in (Application.AssignedRoomID is scanned from
// the DB but never written anywhere in this codebase).
func (s *RoomService) GetActiveResidence(ctx context.Context, studentID uuid.UUID) (*domain.RoomResident, *domain.Room, error) {
	resident, err := s.rooms.GetActiveResidentByStudent(ctx, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, apperror.NotFound("белсенді бөлмеге орналасу жоқ")
		}
		return nil, nil, err
	}
	room, err := s.rooms.GetByID(ctx, resident.RoomID)
	if err != nil {
		return nil, nil, err
	}
	return resident, room, nil
}

func (s *RoomService) ListByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.Room, error) {
	return s.rooms.ListByDormitory(ctx, dormitoryID)
}

func (s *RoomService) Update(ctx context.Context, id uuid.UUID, in RoomInput) (*domain.Room, error) {
	if in.RoomNumber == "" {
		return nil, apperror.BadRequest("бөлме нөмірі міндетті")
	}
	if in.Capacity <= 0 {
		return nil, apperror.BadRequest("сыйымдылық оң сан болуы керек")
	}
	if err := validateBedLevels(in); err != nil {
		return nil, err
	}
	category := in.Category
	if category == "" {
		category = "general"
	}
	room := &domain.Room{
		ID:         id,
		RoomNumber: in.RoomNumber,
		Capacity:   in.Capacity,
		Floor:      in.Floor,
		Category:   category,
		AreaSqM:    in.AreaSqM,
		Equipment:  in.Equipment,
		TopBeds:    in.TopBeds,
		BottomBeds: in.BottomBeds,
	}
	if err := s.rooms.Update(ctx, room); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("бөлме табылмады")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *RoomService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.rooms.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("бөлме табылмады")
		}
		return err
	}
	return nil
}

// UpdateRestrictions only persists the new restrictions if every student
// currently living in the room satisfies them; otherwise it returns a
// conflict describing the first mismatch found.
func (s *RoomService) UpdateRestrictions(ctx context.Context, roomID uuid.UUID, restrictions domain.RoomRestrictions) (*domain.Room, error) {
	if _, err := s.GetByID(ctx, roomID); err != nil {
		return nil, err
	}

	residents, err := s.rooms.ListActiveResidents(ctx, roomID)
	if err != nil {
		return nil, err
	}

	for _, resident := range residents {
		if err := s.checkStudentAgainstRestrictions(ctx, resident.StudentID, restrictions); err != nil {
			return nil, err
		}
	}

	if err := s.rooms.UpdateRestrictions(ctx, roomID, restrictions); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("бөлме табылмады")
		}
		return nil, err
	}
	return s.GetByID(ctx, roomID)
}

// checkStudentAgainstRestrictions returns an apperror.Conflict if the student
// does not satisfy one of the restriction dimensions (gender/course/benefit).
func (s *RoomService) checkStudentAgainstRestrictions(ctx context.Context, studentID uuid.UUID, restrictions domain.RoomRestrictions) error {
	if restrictions.IsEmpty() {
		return nil
	}

	var profile *domain.StudentProfile
	profile, err := s.profiles.GetByUserID(ctx, studentID)
	if err != nil {
		if !errors.Is(err, repository.ErrNotFound) {
			return err
		}
		profile = nil
	}

	if restrictions.Gender != nil {
		if profile == nil || profile.Gender == nil || *profile.Gender != *restrictions.Gender {
			return apperror.Conflict(fmt.Sprintf("%s студенті бөлменің жыныс шектеуіне сай келмейді", studentID))
		}
	}

	if len(restrictions.Courses) > 0 {
		if profile == nil || profile.Course == nil || !containsCourse(restrictions.Courses, *profile.Course) {
			return apperror.Conflict(fmt.Sprintf("%s студенті бөлменің курс шектеуіне сай келмейді", studentID))
		}
	}

	if len(restrictions.BenefitIDs) > 0 {
		studentBenefits, err := s.studentBenefits.ListByStudent(ctx, studentID)
		if err != nil {
			return err
		}
		if !anyBenefitMatches(restrictions.BenefitIDs, studentBenefits) {
			return apperror.Conflict(fmt.Sprintf("%s студентінде бөлме талап ететін льготалардың бірде-біреуі жоқ", studentID))
		}
	}

	return nil
}

func containsCourse(courses []int16, course int16) bool {
	for _, c := range courses {
		if c == course {
			return true
		}
	}
	return false
}

func anyBenefitMatches(required []uuid.UUID, held []*domain.StudentBenefit) bool {
	for _, r := range required {
		for _, h := range held {
			if r == h.BenefitID {
				return true
			}
		}
	}
	return false
}

// CheckAssignable reports whether studentID satisfies roomID's current
// restrictions (gender/course/benefit) — used by ApplicationService.Create to
// reject a student's preferred-room pick up front, before it ever reaches a
// manager.
func (s *RoomService) CheckAssignable(ctx context.Context, roomID, studentID uuid.UUID) error {
	room, err := s.GetByID(ctx, roomID)
	if err != nil {
		return err
	}
	return s.checkStudentAgainstRestrictions(ctx, studentID, room.Restrictions)
}

// AddResident assigns a student to a room. It enforces that the student has
// no other active room, that the room still has free capacity, and that the
// student satisfies the room's current restrictions.
func (s *RoomService) AddResident(ctx context.Context, roomID, studentID uuid.UUID) (*domain.RoomResident, error) {
	room, err := s.GetByID(ctx, roomID)
	if err != nil {
		return nil, err
	}

	student, err := s.users.GetByID(ctx, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("студент табылмады")
		}
		return nil, err
	}
	if student.Role != domain.RoleStudent {
		return nil, apperror.BadRequest("бөлмеге тек студент рөліндегі пайдаланушыны орналастыруға болады")
	}

	if _, err := s.rooms.GetActiveResidentByStudent(ctx, studentID); err == nil {
		return nil, apperror.Conflict("студент бұрыннан бір бөлмеге орналастырылған")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	residents, err := s.rooms.ListActiveResidents(ctx, roomID)
	if err != nil {
		return nil, err
	}
	if len(residents) >= room.Capacity {
		return nil, apperror.Conflict("бөлме толығымен толған")
	}

	if err := s.checkStudentAgainstRestrictions(ctx, studentID, room.Restrictions); err != nil {
		return nil, err
	}

	rr := &domain.RoomResident{RoomID: roomID, StudentID: studentID}
	if err := s.rooms.AddResident(ctx, rr); err != nil {
		return nil, err
	}
	return rr, nil
}

func (s *RoomService) MoveOutResident(ctx context.Context, residentRowID uuid.UUID) error {
	if err := s.rooms.MoveOutResident(ctx, residentRowID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("белсенді тұрғын жазбасы табылмады")
		}
		return err
	}
	return nil
}

func (s *RoomService) ListActiveResidents(ctx context.Context, roomID uuid.UUID) ([]*domain.RoomResident, error) {
	return s.rooms.ListActiveResidents(ctx, roomID)
}
