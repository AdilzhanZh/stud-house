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

func (s *RoomService) Create(ctx context.Context, dormitoryID uuid.UUID, roomNumber string, capacity int) (*domain.Room, error) {
	if roomNumber == "" {
		return nil, apperror.BadRequest("room_number is required")
	}
	if capacity <= 0 {
		return nil, apperror.BadRequest("capacity must be positive")
	}
	if _, err := s.dormitories.GetByID(ctx, dormitoryID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("dormitory not found")
		}
		return nil, err
	}

	room := &domain.Room{DormitoryID: dormitoryID, RoomNumber: roomNumber, Capacity: capacity}
	if err := s.rooms.Create(ctx, room); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("a room with this number already exists in this dormitory")
		}
		return nil, err
	}
	return room, nil
}

func (s *RoomService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Room, error) {
	room, err := s.rooms.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("room not found")
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
			return nil, nil, apperror.NotFound("no active room assignment")
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

func (s *RoomService) Update(ctx context.Context, id uuid.UUID, roomNumber string, capacity int) (*domain.Room, error) {
	if roomNumber == "" {
		return nil, apperror.BadRequest("room_number is required")
	}
	if capacity <= 0 {
		return nil, apperror.BadRequest("capacity must be positive")
	}
	room := &domain.Room{ID: id, RoomNumber: roomNumber, Capacity: capacity}
	if err := s.rooms.Update(ctx, room); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("room not found")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *RoomService) Delete(ctx context.Context, id uuid.UUID) error {
	if err := s.rooms.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("room not found")
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
			return nil, apperror.NotFound("room not found")
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
			return apperror.Conflict(fmt.Sprintf("resident %s does not match the room's gender restriction", studentID))
		}
	}

	if len(restrictions.Courses) > 0 {
		if profile == nil || profile.Course == nil || !containsCourse(restrictions.Courses, *profile.Course) {
			return apperror.Conflict(fmt.Sprintf("resident %s does not match the room's course restriction", studentID))
		}
	}

	if len(restrictions.BenefitIDs) > 0 {
		studentBenefits, err := s.studentBenefits.ListByStudent(ctx, studentID)
		if err != nil {
			return err
		}
		if !anyBenefitMatches(restrictions.BenefitIDs, studentBenefits) {
			return apperror.Conflict(fmt.Sprintf("resident %s does not hold any of the room's required benefits", studentID))
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
			return nil, apperror.NotFound("student not found")
		}
		return nil, err
	}
	if student.Role != domain.RoleStudent {
		return nil, apperror.BadRequest("only users with role=student can be assigned to a room")
	}

	if _, err := s.rooms.GetActiveResidentByStudent(ctx, studentID); err == nil {
		return nil, apperror.Conflict("student already has an active room assignment")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	residents, err := s.rooms.ListActiveResidents(ctx, roomID)
	if err != nil {
		return nil, err
	}
	if len(residents) >= room.Capacity {
		return nil, apperror.Conflict("room is already at full capacity")
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
			return apperror.NotFound("active resident record not found")
		}
		return err
	}
	return nil
}

func (s *RoomService) ListActiveResidents(ctx context.Context, roomID uuid.UUID) ([]*domain.RoomResident, error) {
	return s.rooms.ListActiveResidents(ctx, roomID)
}
