package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

var (
	ErrNotFound = errors.New("resource not found")
	ErrConflict = errors.New("resource already exists")
)

type UserRepository interface {
	Create(ctx context.Context, u *domain.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) error
	UpdateChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error
	ListByRole(ctx context.Context, role domain.Role) ([]*domain.User, error)
	// List optionally filters by role (nil = every user), for the admin
	// panel's user list (frontend kezeng 4: GET /admin/users?role=).
	List(ctx context.Context, role *domain.Role) ([]*domain.User, error)
}

type StudentProfileRepository interface {
	Upsert(ctx context.Context, p *domain.StudentProfile) error
	GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.StudentProfile, error)
}

type DormitoryRepository interface {
	Create(ctx context.Context, d *domain.Dormitory) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Dormitory, error)
	List(ctx context.Context) ([]*domain.Dormitory, error)
	Update(ctx context.Context, d *domain.Dormitory) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetCapacity(ctx context.Context, id uuid.UUID) (*domain.DormitoryCapacity, error)
	AddImage(ctx context.Context, img *domain.DormitoryImage) error
	ListImages(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryImage, error)
	DeleteImage(ctx context.Context, imageID uuid.UUID) error
}

type RoomRepository interface {
	Create(ctx context.Context, r *domain.Room) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Room, error)
	ListByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.Room, error)
	Update(ctx context.Context, r *domain.Room) error
	UpdateRestrictions(ctx context.Context, id uuid.UUID, restrictions domain.RoomRestrictions) error
	Delete(ctx context.Context, id uuid.UUID) error
	ListActiveResidents(ctx context.Context, roomID uuid.UUID) ([]*domain.RoomResident, error)
	AddResident(ctx context.Context, rr *domain.RoomResident) error
	MoveOutResident(ctx context.Context, residentRowID uuid.UUID) error
	GetActiveResidentByStudent(ctx context.Context, studentID uuid.UUID) (*domain.RoomResident, error)
}

type BenefitRepository interface {
	Create(ctx context.Context, b *domain.Benefit) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Benefit, error)
	List(ctx context.Context) ([]*domain.Benefit, error)
	Update(ctx context.Context, b *domain.Benefit) error
	Delete(ctx context.Context, id uuid.UUID) error

	AddField(ctx context.Context, f *domain.BenefitField) error
	ListFields(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitField, error)
	DeleteField(ctx context.Context, fieldID uuid.UUID) error

	AddRequiredDocument(ctx context.Context, d *domain.BenefitRequiredDocument) error
	ListRequiredDocuments(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitRequiredDocument, error)
	DeleteRequiredDocument(ctx context.Context, docID uuid.UUID) error
}

type StudentBenefitRepository interface {
	Assign(ctx context.Context, sb *domain.StudentBenefit) error
	ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.StudentBenefit, error)
	Revoke(ctx context.Context, studentID, benefitID uuid.UUID) error
}

type RefreshTokenRepository interface {
	Create(ctx context.Context, rt *domain.RefreshToken) error
	GetByHash(ctx context.Context, tokenHash string) (*domain.RefreshToken, error)
	Revoke(ctx context.Context, id uuid.UUID) error
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
}
