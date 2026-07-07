package service

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
	"student-house/pkg/hasher"
)

type UserService struct {
	users    repository.UserRepository
	profiles repository.StudentProfileRepository
}

func NewUserService(users repository.UserRepository, profiles repository.StudentProfileRepository) *UserService {
	return &UserService{users: users, profiles: profiles}
}

// CreateUser is admin-only: it can create any role, including other admins.
// Students normally self-register via AuthService.RegisterStudent instead.
func (s *UserService) CreateUser(ctx context.Context, fullName, email, phone, password string, role domain.Role) (*domain.User, error) {
	if !role.Valid() {
		return nil, apperror.BadRequest("invalid role")
	}
	if fullName == "" || email == "" || password == "" {
		return nil, apperror.BadRequest("full_name, email and password are required")
	}
	if len(password) < 8 {
		return nil, apperror.BadRequest("password must be at least 8 characters")
	}

	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, apperror.Conflict("a user with this email already exists")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	passwordHash, err := hasher.HashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		FullName:     fullName,
		Email:        email,
		Phone:        phone,
		PasswordHash: passwordHash,
		Role:         role,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("a user with this email already exists")
		}
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	user, err := s.users.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("user not found")
		}
		return nil, err
	}
	return user, nil
}

// UpdateRole is admin-only. Changing a user's role away from committee_member
// implicitly clears the chairperson flag, since chairperson only makes sense
// on top of that role.
func (s *UserService) UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) error {
	if !role.Valid() {
		return apperror.BadRequest("invalid role")
	}
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.users.UpdateRole(ctx, id, role); err != nil {
		return err
	}
	if role != domain.RoleCommitteeMember && user.IsChairperson {
		return s.users.UpdateChairperson(ctx, id, false)
	}
	return nil
}

// SetChairperson is admin-only and only valid for users already in the
// committee_member role.
func (s *UserService) SetChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if user.Role != domain.RoleCommitteeMember {
		return apperror.BadRequest("chairperson can only be assigned to a committee_member")
	}
	return s.users.UpdateChairperson(ctx, id, isChairperson)
}

func (s *UserService) ListCommitteeMembers(ctx context.Context) ([]*domain.User, error) {
	return s.users.ListByRole(ctx, domain.RoleCommitteeMember)
}

func (s *UserService) UpsertStudentProfile(ctx context.Context, userID uuid.UUID, gender *domain.Gender, course *int16) error {
	user, err := s.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.Role != domain.RoleStudent {
		return apperror.BadRequest("a profile (gender/course) can only be set for a student")
	}
	if gender != nil && !gender.Valid() {
		return apperror.BadRequest("invalid gender")
	}
	if course != nil && (*course < 1 || *course > 6) {
		return apperror.BadRequest("course must be between 1 and 6")
	}
	return s.profiles.Upsert(ctx, &domain.StudentProfile{UserID: userID, Gender: gender, Course: course})
}

func (s *UserService) GetStudentProfile(ctx context.Context, userID uuid.UUID) (*domain.StudentProfile, error) {
	profile, err := s.profiles.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("student profile not found")
		}
		return nil, err
	}
	return profile, nil
}
