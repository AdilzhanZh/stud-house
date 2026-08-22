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
	GetByIIN(ctx context.Context, iin string) (*domain.User, error)
	UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) error
	UpdateCommitteeMember(ctx context.Context, id uuid.UUID, isCommitteeMember bool) error
	UpdateChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error
	UpdateAvatar(ctx context.Context, id uuid.UUID, avatarURL *string) error
	ListByRole(ctx context.Context, role domain.Role) ([]*domain.User, error)
	// ListCommitteeMembers returns every user with is_committee_member = true
	// (a flag on managers, elected by admin — not a separate role).
	ListCommitteeMembers(ctx context.Context) ([]*domain.User, error)
	// List optionally filters by role (nil = every user), for the admin
	// panel's user list (frontend kezeng 4: GET /admin/users?role=).
	List(ctx context.Context, role *domain.Role) ([]*domain.User, error)
	// ListPendingStudents is the manager/admin queue of self-registered
	// students awaiting approval before they can log in.
	ListPendingStudents(ctx context.Context) ([]*domain.User, error)
	// ListUnhoused returns approved students who have no active
	// room_residents row (moved_out_at IS NULL) — i.e. they belong on
	// campus but aren't currently placed in any room, regardless of
	// whether they ever filed an application.
	ListUnhoused(ctx context.Context) ([]*domain.User, error)
	UpdateApprovalStatus(ctx context.Context, id uuid.UUID, status domain.ApprovalStatus) error
	UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error
	// UpdateEmail is used by cmd/seed to repoint the single admin account at
	// a new login email instead of creating a second admin row, and by
	// UserService.ChangeOwnEmail for a user changing their own email from
	// their profile.
	UpdateEmail(ctx context.Context, id uuid.UUID, email string) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type StudentProfileRepository interface {
	Upsert(ctx context.Context, p *domain.StudentProfile) error
	GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.StudentProfile, error)
}

type DormitoryRepository interface {
	Create(ctx context.Context, d *domain.Dormitory) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Dormitory, error)
	// List returns every dormitory when openOnly is false, or only
	// dormitories open for applications when true.
	List(ctx context.Context, openOnly bool) ([]*domain.Dormitory, error)
	Update(ctx context.Context, d *domain.Dormitory) error
	Delete(ctx context.Context, id uuid.UUID) error
	GetCapacity(ctx context.Context, id uuid.UUID) (*domain.DormitoryCapacity, error)
	AddImage(ctx context.Context, img *domain.DormitoryImage) error
	ListImages(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryImage, error)
	DeleteImage(ctx context.Context, imageID uuid.UUID) error

	AddRequiredDocument(ctx context.Context, d *domain.DormitoryRequiredDocument) error
	ListRequiredDocuments(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryRequiredDocument, error)
	DeleteRequiredDocument(ctx context.Context, docID uuid.UUID) error
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
	// GetResidentByID resolves a room_residents row by its own id, regardless
	// of whether it's still active — used to look up which student/room a
	// release or transfer action applies to before mutating it.
	GetResidentByID(ctx context.Context, id uuid.UUID) (*domain.RoomResident, error)
	// ListResidentStudentIDsByDormitory backs the admin "жатақхана" broadcast
	// audience — every student currently resident (moved_out_at IS NULL) in
	// any room of the given dormitory.
	ListResidentStudentIDsByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]uuid.UUID, error)
	// CountHeldSeats counts non-terminal applications currently claiming
	// roomID (see RoomService.CheckHoldable) — used to keep a pending
	// applicant's room pick from exceeding capacity before any
	// room_residents row exists.
	CountHeldSeats(ctx context.Context, roomID uuid.UUID, excludeApplicationID *uuid.UUID) (int, error)
	// ListAvailabilityByDormitory returns every room of a dormitory with its
	// resident and hold counts, for the room-picker UI.
	ListAvailabilityByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.RoomAvailability, error)
}

type RequiredDocumentRepository interface {
	Create(ctx context.Context, d *domain.RequiredDocument) error
	List(ctx context.Context) ([]*domain.RequiredDocument, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

type BenefitRepository interface {
	Create(ctx context.Context, b *domain.Benefit) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Benefit, error)
	List(ctx context.Context) ([]*domain.Benefit, error)
	Update(ctx context.Context, b *domain.Benefit) error
	Delete(ctx context.Context, id uuid.UUID) error

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
