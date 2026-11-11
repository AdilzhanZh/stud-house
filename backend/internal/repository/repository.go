package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

var (
	ErrNotFound = errors.New("resource not found")
	ErrConflict = errors.New("resource already exists")

	// Bed place errors (see RoomRepository).
	ErrBedOccupied = errors.New("bed is occupied")
	ErrNoFreeBed   = errors.New("room has no free bed")
	ErrBedRetired  = errors.New("bed is retired")
	ErrLastBed     = errors.New("room must keep at least one bed")
	ErrBedReserved = errors.New("bed is reserved by an application")
	// ErrBedOutOfService: the bed is under repair or temporarily unavailable.
	ErrBedOutOfService = errors.New("bed is out of service")

	// Object/floor errors (see HierarchyRepository).
	ErrNotEmpty       = errors.New("still has rooms or buildings")
	ErrObjectNotFound = errors.New("object not found")
)

// HierarchyRepository stores the registry levels around a dormitory
// (корпус): the object above it (domain.DormObject) and the floors below it
// (domain.Floor). Floors are never deleted, only retired once empty; Get*
// return retired floors too. Duplicate object names / active floor numbers
// return ErrConflict.
type HierarchyRepository interface {
	ListObjects(ctx context.Context) ([]*domain.DormObject, error)
	GetObject(ctx context.Context, id uuid.UUID) (*domain.DormObject, error)
	CreateObject(ctx context.Context, o *domain.DormObject) error
	UpdateObject(ctx context.Context, o *domain.DormObject) error
	// DeleteObject: ErrNotEmpty while buildings belong to it.
	DeleteObject(ctx context.Context, id uuid.UUID) error
	// MoveDormitories puts the buildings into the object (merging objects);
	// objects left without buildings are removed. ErrNotFound if the object
	// or any building is missing.
	MoveDormitories(ctx context.Context, objectID uuid.UUID, dormitoryIDs []uuid.UUID) error

	ListFloors(ctx context.Context, dormitoryID uuid.UUID, includeRetired bool) ([]*domain.Floor, error)
	GetFloor(ctx context.Context, id uuid.UUID) (*domain.Floor, error)
	FindActiveFloor(ctx context.Context, dormitoryID uuid.UUID, number *int) (*domain.Floor, error)
	CreateFloor(ctx context.Context, f *domain.Floor) error
	UpdateFloor(ctx context.Context, f *domain.Floor) error
	// RetireFloor: ErrNotEmpty while rooms are on it.
	RetireFloor(ctx context.Context, id uuid.UUID) error

	Registry(ctx context.Context, objectID, dormitoryID *uuid.UUID) ([]*domain.RegistryRow, error)
}

type UserRepository interface {
	Create(ctx context.Context, u *domain.User) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	GetByIIN(ctx context.Context, iin string) (*domain.User, error)
	UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) error
	UpdateManager(ctx context.Context, id uuid.UUID, isManager bool) error
	UpdateCommitteeMember(ctx context.Context, id uuid.UUID, isCommitteeMember bool) error
	// ListManagers returns every role=user holding the manager position.
	ListManagers(ctx context.Context) ([]*domain.User, error)
	UpdateChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error
	UpdateAvatar(ctx context.Context, id uuid.UUID, avatarURL *string) error
	ListByRole(ctx context.Context, role domain.Role) ([]*domain.User, error)
	// ListCommitteeMembers returns every user with is_committee_member = true
	// (a flag on role=user, elected by admin — not a separate role).
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
	UpdatePhone(ctx context.Context, id uuid.UUID, phone string) error
	// UpdateIIN returns ErrConflict if another account already has that IIN.
	UpdateIIN(ctx context.Context, id uuid.UUID, iin string) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type StudentProfileRepository interface {
	Upsert(ctx context.Context, p *domain.StudentProfile) error
	GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.StudentProfile, error)
	UpdateDetails(ctx context.Context, userID uuid.UUID, d domain.StudentDetails) error
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
	// AddResident puts the stay on rr.BedID, or, when rr.BedID is nil, on
	// the bed the student's own application holds in this room, else the
	// room's first free bed. Beds out of service or held by another
	// student's application are never taken. Fills rr's bed fields. Errors:
	// ErrNotFound (bed not in this room), ErrBedRetired, ErrBedOccupied,
	// ErrBedReserved, ErrBedOutOfService, ErrNoFreeBed, ErrConflict
	// (student already has an active stay).
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
	// resident, hold and out-of-service counts, for the room-picker UI.
	ListAvailabilityByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.RoomAvailability, error)
	// CountOutOfServiceBeds counts the room's active beds under repair or
	// temporarily unavailable.
	CountOutOfServiceBeds(ctx context.Context, roomID uuid.UUID) (int, error)

	// Bed places. Create makes Capacity beds for a new room and Update
	// adds/retires beds so the active count matches the new Capacity
	// (ErrBedOccupied when too few beds are free to retire; beds out of
	// service go first, occupied or reserved beds never). AddBeds and
	// RetireBed change one room's beds directly and keep rooms.capacity
	// equal to the active bed count.
	ListBeds(ctx context.Context, roomID uuid.UUID, includeRetired bool) ([]*domain.Bed, error)
	GetBedByID(ctx context.Context, id uuid.UUID) (*domain.Bed, error)
	AddBeds(ctx context.Context, roomID uuid.UUID, count int) ([]*domain.Bed, error)
	// RetireBed returns ErrBedOccupied if a student is on it, ErrBedReserved
	// if an application holds it, ErrBedRetired if already retired,
	// ErrLastBed if it is the room's only active bed.
	RetireBed(ctx context.Context, bedID uuid.UUID) error
	// SetBedServiceStatus takes a bed out of service (repair/unavailable,
	// with reason and optional expected end date) or returns it to service
	// (reason/until must be nil) and returns the updated bed. The status log
	// entry is written by the database, with the author and act taken from
	// ctx (domain.BedLogContext).
	// Errors: ErrNotFound, ErrBedRetired, ErrBedOccupied, ErrBedReserved.
	SetBedServiceStatus(ctx context.Context, bedID uuid.UUID, status domain.BedServiceStatus,
		reason *string, until *time.Time, changedBy uuid.UUID) (*domain.Bed, error)
	// ListBedStatusHistory returns the bed's status log, newest first.
	ListBedStatusHistory(ctx context.Context, bedID uuid.UUID) ([]*domain.BedStatusChange, error)
	// RenameBed returns ErrConflict if another active bed of the room has
	// that label, ErrBedRetired if the bed is retired.
	RenameBed(ctx context.Context, bedID uuid.UUID, label string) error
	// ListBedHistory returns every stay on the bed, newest first.
	ListBedHistory(ctx context.Context, bedID uuid.UUID) ([]*domain.RoomResident, error)
}

type RequiredDocumentRepository interface {
	Create(ctx context.Context, d *domain.RequiredDocument) error
	List(ctx context.Context) ([]*domain.RequiredDocument, error)
	// SetValidityDays sets (or, with nil, clears) how long the document
	// stays valid after issue.
	SetValidityDays(ctx context.Context, id uuid.UUID, validityDays *int) error
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
