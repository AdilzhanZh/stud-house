package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

type RoomService struct {
	rooms           repository.RoomRepository
	floors          repository.HierarchyRepository
	dormitories     repository.DormitoryRepository
	users           repository.UserRepository
	profiles        repository.StudentProfileRepository
	studentBenefits repository.StudentBenefitRepository
	notifier        *notifier.Notifier
}

func NewRoomService(
	rooms repository.RoomRepository,
	floors repository.HierarchyRepository,
	dormitories repository.DormitoryRepository,
	users repository.UserRepository,
	profiles repository.StudentProfileRepository,
	studentBenefits repository.StudentBenefitRepository,
	notifier *notifier.Notifier,
) *RoomService {
	return &RoomService{
		rooms:           rooms,
		floors:          floors,
		dormitories:     dormitories,
		users:           users,
		profiles:        profiles,
		studentBenefits: studentBenefits,
		notifier:        notifier,
	}
}

// RoomInput bundles the admin "create/edit room" form fields.
type RoomInput struct {
	RoomNumber string
	Capacity   int
	// FloorID places the room. Floor (a number) is the older way: the
	// dormitory's floor with this number is used, created if missing.
	FloorID  *uuid.UUID
	Floor    *int
	Category string
	// Optional descriptive fields; nil / empty clears them.
	AreaSqM            *float64
	Equipment          *string
	SanitaryConditions *string
	IsAccessible       *bool
	AccessibilityNotes *string
	PhotoURLs          []string
}

// normalizedDetails checks the optional descriptive fields and returns them
// normalized (blank text -> nil).
func (in RoomInput) normalizedDetails() (RoomInput, error) {
	if in.AreaSqM != nil && (*in.AreaSqM <= 0 || *in.AreaSqM >= 10000) {
		return in, apperror.BadRequest("аудан 0-ден үлкен болуы керек")
	}
	in.Equipment = trimOrNil(in.Equipment)
	in.SanitaryConditions = trimOrNil(in.SanitaryConditions)
	in.AccessibilityNotes = trimOrNil(in.AccessibilityNotes)
	urls := make([]string, 0, len(in.PhotoURLs))
	for _, u := range in.PhotoURLs {
		if u = strings.TrimSpace(u); u != "" {
			urls = append(urls, u)
		}
	}
	in.PhotoURLs = urls
	return in, nil
}

func trimOrNil(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return &v
}

func applyRoomDetails(room *domain.Room, in RoomInput) {
	room.AreaSqM = in.AreaSqM
	room.Equipment = in.Equipment
	room.SanitaryConditions = in.SanitaryConditions
	room.IsAccessible = in.IsAccessible
	room.AccessibilityNotes = in.AccessibilityNotes
	room.PhotoURLs = in.PhotoURLs
}

func (s *RoomService) Create(ctx context.Context, dormitoryID uuid.UUID, in RoomInput) (*domain.Room, error) {
	if in.RoomNumber == "" {
		return nil, apperror.BadRequest("бөлме нөмірі міндетті")
	}
	if in.Capacity <= 0 {
		return nil, apperror.BadRequest("сыйымдылық оң сан болуы керек")
	}
	in, err := in.normalizedDetails()
	if err != nil {
		return nil, err
	}
	if _, err := s.dormitories.GetByID(ctx, dormitoryID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("жатақхана табылмады")
		}
		return nil, err
	}

	floor, err := s.resolveFloor(ctx, dormitoryID, in)
	if err != nil {
		return nil, err
	}

	category := in.Category
	if category == "" {
		category = "general"
	}
	room := &domain.Room{
		DormitoryID: dormitoryID,
		FloorID:     floor.ID,
		RoomNumber:  in.RoomNumber,
		Capacity:    in.Capacity,
		Category:    category,
	}
	applyRoomDetails(room, in)
	if err := s.rooms.Create(ctx, room); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict(roomNumberTakenMessage)
		}
		return nil, err
	}
	return s.GetByID(ctx, room.ID)
}

const roomNumberTakenMessage = "бұл жатақханада осы нөмірлі бөлме бұрыннан бар"

// resolveFloor finds the floor a room create/update puts the room on and
// checks it is an active floor of dormitoryID — a room can move between
// floors of its building, never to another building.
func (s *RoomService) resolveFloor(ctx context.Context, dormitoryID uuid.UUID, in RoomInput) (*domain.Floor, error) {
	if in.FloorID == nil {
		if in.Floor == nil {
			return nil, apperror.BadRequest("қабат көрсетілуі міндетті")
		}
		floor, err := s.floors.FindActiveFloor(ctx, dormitoryID, in.Floor)
		if err == nil {
			return floor, nil
		}
		if !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
		floor = &domain.Floor{DormitoryID: dormitoryID, Number: in.Floor}
		if err := s.floors.CreateFloor(ctx, floor); err != nil {
			if errors.Is(err, repository.ErrConflict) {
				// Created concurrently by someone else: use theirs.
				return s.floors.FindActiveFloor(ctx, dormitoryID, in.Floor)
			}
			return nil, err
		}
		return floor, nil
	}

	floor, err := s.floors.GetFloor(ctx, *in.FloorID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, apperror.BadRequest("қабат табылмады")
	}
	if err != nil {
		return nil, err
	}
	if floor.DormitoryID != dormitoryID {
		return nil, apperror.BadRequest("қабат басқа жатақханаға жатады")
	}
	if floor.RetiredAt != nil {
		return nil, apperror.Conflict("бұл қабат алынып тасталған")
	}
	return floor, nil
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
	in, err := in.normalizedDetails()
	if err != nil {
		return nil, err
	}
	existing, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	floor, err := s.resolveFloor(ctx, existing.DormitoryID, in)
	if err != nil {
		return nil, err
	}
	category := in.Category
	if category == "" {
		category = "general"
	}
	room := &domain.Room{
		ID:         id,
		FloorID:    floor.ID,
		RoomNumber: in.RoomNumber,
		Capacity:   in.Capacity,
		Category:   category,
	}
	applyRoomDetails(room, in)
	// The repository adds or retires bed places to match the new capacity;
	// existing beds keep their ids.
	if err := s.rooms.Update(ctx, room); err != nil {
		switch {
		case errors.Is(err, repository.ErrNotFound):
			return nil, apperror.NotFound("бөлме табылмады")
		case errors.Is(err, repository.ErrConflict):
			return nil, apperror.Conflict(roomNumberTakenMessage)
		case errors.Is(err, repository.ErrBedOccupied):
			return nil, apperror.Conflict("сыйымдылықты азайту үшін бос төсек-орын жеткіліксіз — алдымен тұрғындарды басқа орынға ауыстырыңыз")
		}
		return nil, err
	}
	return s.GetByID(ctx, id)
}

// Delete refuses to remove a room that still has active residents — since
// room_residents cascades on room deletion, deleting it out from under them
// would silently erase their residency history instead of releasing them
// through MoveOutResident (which also notifies the student). A room still
// referenced by an application/transfer request surfaces as a conflict too
// (see RoomRepo.Delete).
func (s *RoomService) Delete(ctx context.Context, id uuid.UUID) error {
	residents, err := s.rooms.ListActiveResidents(ctx, id)
	if err != nil {
		return err
	}
	if len(residents) > 0 {
		return apperror.Conflict("бөлмеде тұрғындар бар, оны өшірмес бұрын алдымен оларды шығарыңыз")
	}

	if err := s.rooms.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("бөлме табылмады")
		}
		if errors.Is(err, repository.ErrConflict) {
			return apperror.Conflict("бұл бөлмеге тіркелген өтініш немесе ауысу сұранысы бар, оны өшіру мүмкін емес")
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
// does not satisfy one of the restriction dimensions (gender/course/degree/benefit).
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

	if len(restrictions.Degrees) > 0 {
		if profile == nil || profile.AcademicDegree == nil || !containsDegree(restrictions.Degrees, *profile.AcademicDegree) {
			return apperror.Conflict(fmt.Sprintf("%s студенті бөлменің оқу деңгейі шектеуіне сай келмейді", studentID))
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

func containsDegree(degrees []domain.AcademicDegree, degree domain.AcademicDegree) bool {
	for _, d := range degrees {
		if d == degree {
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

// ValidateAssignable checks that studentID could be placed in roomID right
// now — room exists, student is a student, has no other active room, the
// room still has free capacity, and the student satisfies the room's current
// restrictions — without creating the room_residents row. Used at
// manager-approval time (ApplicationService.Decide), before the student has
// accepted a contract: the seat itself is only claimed later, in
// ContractService.Respond's accept branch, via AddResident below.
func (s *RoomService) ValidateAssignable(ctx context.Context, roomID, studentID uuid.UUID) (*domain.Room, error) {
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
	usable, err := s.usableBeds(ctx, room)
	if err != nil {
		return nil, err
	}
	if len(residents) >= usable {
		return nil, apperror.Conflict("бөлме толығымен толған")
	}

	if err := s.checkStudentAgainstRestrictions(ctx, studentID, room.Restrictions); err != nil {
		return nil, err
	}

	return room, nil
}

// AddResident assigns a student to a room, claiming the seat immediately
// (see ValidateAssignable for the checks it runs first). bedID picks the
// bed place; nil takes the room's first free bed.
func (s *RoomService) AddResident(ctx context.Context, roomID, studentID uuid.UUID, bedID *uuid.UUID) (*domain.RoomResident, error) {
	if _, err := s.ValidateAssignable(ctx, roomID, studentID); err != nil {
		return nil, err
	}

	rr := &domain.RoomResident{RoomID: roomID, StudentID: studentID, BedID: bedID}
	if err := s.rooms.AddResident(ctx, rr); err != nil {
		return nil, bedPlacementError(err)
	}
	return rr, nil
}

// bedPlacementError maps RoomRepository.AddResident's bed errors to API errors.
func bedPlacementError(err error) error {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		return apperror.NotFound("бұл бөлмеде мұндай төсек-орын табылмады")
	case errors.Is(err, repository.ErrBedRetired):
		return apperror.Conflict("бұл төсек-орын алынып тасталған")
	case errors.Is(err, repository.ErrBedOccupied):
		return apperror.Conflict("бұл төсек-орын бос емес")
	case errors.Is(err, repository.ErrBedReserved):
		return apperror.Conflict("бұл төсек-орын өтініш бойынша брондалған")
	case errors.Is(err, repository.ErrBedOutOfService):
		return apperror.Conflict("бұл төсек-орын жөндеуде немесе уақытша қолжетімсіз")
	case errors.Is(err, repository.ErrNoFreeBed):
		return apperror.Conflict("бөлмеде бос төсек-орын жоқ")
	case errors.Is(err, repository.ErrConflict):
		return apperror.Conflict("студент бұрыннан бір бөлмеге орналастырылған")
	}
	return err
}

// MoveOutResident is the admin/manager-facing "release from room" action: it
// ends the resident's stay and notifies the student directly (in-app +
// email). This is distinct from ExitRequestService's approval path, which
// closes out the room_residents row via the repository directly and sends
// its own "exit request approved" notification instead — so no risk of a
// duplicate notification when a request is approved through that flow.
func (s *RoomService) MoveOutResident(ctx context.Context, residentRowID uuid.UUID) error {
	resident, err := s.rooms.GetResidentByID(ctx, residentRowID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("белсенді тұрғын жазбасы табылмады")
		}
		return err
	}

	if err := s.rooms.MoveOutResident(ctx, residentRowID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("белсенді тұрғын жазбасы табылмады")
		}
		return err
	}

	_ = s.notifier.Notify(ctx, resident.StudentID, domain.NotificationRoomResidentReleased,
		"Бөлмеден шығарылдыңыз",
		"Сіз жатақхана әкімшілігі тарапынан бөлмеден шығарылдыңыз.", nil)
	return nil
}

// TransferResident is the admin/manager-facing "move this resident to a
// different bed" action: another room, or another bed in the same room.
// newBedID picks the bed; nil takes the target room's first free bed (only
// allowed when changing rooms). Bed places themselves never change — only
// which bed the student's stay points to — so every bed keeps its permanent
// id and history.
//
// Unlike TransferRequestService.Decide's approval step (which vacates the
// old room before checking the new one, and accepts the narrow risk of
// leaving the student roomless if that check fails — acceptable there since
// a request only reaches approval after a manager already looked at it),
// this direct action validates the target room's capacity/gender/course/
// benefit fit and the target bed up front, before touching the old
// room_residents row: a manager picking an invalid destination is the
// common case here, not an edge case, so it must never strand the student
// with no active room at all.
func (s *RoomService) TransferResident(ctx context.Context, residentRowID, newRoomID uuid.UUID, newBedID *uuid.UUID) (*domain.RoomResident, error) {
	resident, err := s.rooms.GetResidentByID(ctx, residentRowID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("белсенді тұрғын жазбасы табылмады")
		}
		return nil, err
	}
	if resident.MovedOutAt != nil {
		return nil, apperror.Conflict("тұрғын бұрын осы бөлмеден шыққан")
	}
	sameRoom := resident.RoomID == newRoomID
	if sameRoom && newBedID == nil {
		return nil, apperror.Conflict("студент бұрыннан осы бөлмеде тұрады")
	}

	newRoom, err := s.GetByID(ctx, newRoomID)
	if err != nil {
		return nil, err
	}
	if newBedID != nil {
		if resident.BedID != nil && *resident.BedID == *newBedID {
			return nil, apperror.Conflict("студент бұрыннан осы төсек-орында тұрады")
		}
		bed, err := s.rooms.GetBedByID(ctx, *newBedID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
		if err != nil || bed.RoomID != newRoomID {
			return nil, apperror.NotFound("бұл бөлмеде мұндай төсек-орын табылмады")
		}
		if bed.RetiredAt != nil {
			return nil, apperror.Conflict("бұл төсек-орын алынып тасталған")
		}
		if bed.ResidentID != nil {
			return nil, apperror.Conflict("бұл төсек-орын бос емес")
		}
	}
	if !sameRoom {
		newRoomResidents, err := s.rooms.ListActiveResidents(ctx, newRoomID)
		if err != nil {
			return nil, err
		}
		if len(newRoomResidents) >= newRoom.Capacity {
			return nil, apperror.Conflict("бөлме толығымен толған")
		}
		if err := s.checkStudentAgainstRestrictions(ctx, resident.StudentID, newRoom.Restrictions); err != nil {
			return nil, err
		}
	}

	if err := s.rooms.MoveOutResident(ctx, residentRowID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("белсенді тұрғын жазбасы табылмады")
		}
		return nil, err
	}

	// The checks above were already satisfied, so this should succeed
	// barring a concurrent write to the target room in between — the same
	// narrow check-then-act race already accepted throughout this codebase
	// (no cross-repository transactions exist anywhere in it).
	newResident, err := s.AddResident(ctx, newRoomID, resident.StudentID, newBedID)
	if err != nil {
		return nil, err
	}

	bedLabel := ""
	if newResident.BedLabel != nil {
		bedLabel = *newResident.BedLabel
	}
	_ = s.notifier.Notify(ctx, resident.StudentID, domain.NotificationRoomResidentTransferred,
		"Бөлме ауыстырылды",
		fmt.Sprintf("Сіз жаңа орынға (бөлме №%s, төсек-орын %s) ауыстырылдыңыз.", newRoom.RoomNumber, bedLabel), nil)

	return newResident, nil
}

func (s *RoomService) ListActiveResidents(ctx context.Context, roomID uuid.UUID) ([]*domain.RoomResident, error) {
	return s.rooms.ListActiveResidents(ctx, roomID)
}

// CheckHoldable reports whether roomID still has a free seat once both
// actual residents and other pending applicants' holds are counted — a
// hold being any non-terminal, non-correction application (pending/
// manager_review/approved) currently claiming that room (see
// RoomRepository.CountHeldSeats). excludeApplicationID lets a caller check
// whether an application may keep/take this room without counting its own
// existing hold on it against itself.
//
// This is deliberately separate from ValidateAssignable, which continues to
// check only actual residents: that method gates the final, authoritative
// seat claim at contract-acceptance time (RoomService.AddResident), by
// which point this application's own hold is meant to convert into that
// exact seat, not be double-counted against it. CheckHoldable instead runs
// at the two points a hold is created or kept — ApplicationService.Create
// and the approve branch of ApplicationService.Decide.
func (s *RoomService) CheckHoldable(ctx context.Context, roomID uuid.UUID, excludeApplicationID *uuid.UUID) error {
	room, err := s.GetByID(ctx, roomID)
	if err != nil {
		return err
	}
	residents, err := s.rooms.ListActiveResidents(ctx, roomID)
	if err != nil {
		return err
	}
	held, err := s.rooms.CountHeldSeats(ctx, roomID, excludeApplicationID)
	if err != nil {
		return err
	}
	usable, err := s.usableBeds(ctx, room)
	if err != nil {
		return err
	}
	if len(residents)+held >= usable {
		return apperror.Conflict("бөлме толығымен толған")
	}
	return nil
}

// CheckBedHoldable reports whether the application of studentID may
// reserve bedID in roomID: the bed must be in that room, not retired, in
// service, with nobody else living on it and no other application holding
// it (applicationID's own hold on it is fine).
func (s *RoomService) CheckBedHoldable(ctx context.Context, roomID, bedID, applicationID, studentID uuid.UUID) error {
	bed, err := s.rooms.GetBedByID(ctx, bedID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("төсек-орын табылмады")
		}
		return err
	}
	switch {
	case bed.RoomID != roomID:
		return apperror.NotFound("бұл бөлмеде мұндай төсек-орын табылмады")
	case bed.RetiredAt != nil:
		return apperror.Conflict("бұл төсек-орын алынып тасталған")
	case bed.ServiceStatus != domain.BedInService:
		return apperror.Conflict("бұл төсек-орын жөндеуде немесе уақытша қолжетімсіз")
	case bed.StudentID != nil && *bed.StudentID != studentID:
		return apperror.Conflict("бұл төсек-орын бос емес")
	case bed.HeldApplicationID != nil && *bed.HeldApplicationID != applicationID:
		return apperror.Conflict("бұл төсек-орын өтініш бойынша брондалған")
	}
	return nil
}

// usableBeds is the room's active beds minus those under repair or
// temporarily unavailable — the seats that can be lived on or held.
func (s *RoomService) usableBeds(ctx context.Context, room *domain.Room) (int, error) {
	out, err := s.rooms.CountOutOfServiceBeds(ctx, room.ID)
	if err != nil {
		return 0, err
	}
	return room.Capacity - out, nil
}

// ListAvailabilityByDormitory returns every room of a dormitory with its
// current resident and hold counts, for the student-facing room picker.
func (s *RoomService) ListAvailabilityByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.RoomAvailability, error) {
	return s.rooms.ListAvailabilityByDormitory(ctx, dormitoryID)
}

// ListBeds returns a room's bed places with who is on each; retired beds
// are included (listed last) when includeRetired is set.
func (s *RoomService) ListBeds(ctx context.Context, roomID uuid.UUID, includeRetired bool) ([]*domain.Bed, error) {
	if _, err := s.GetByID(ctx, roomID); err != nil {
		return nil, err
	}
	return s.rooms.ListBeds(ctx, roomID, includeRetired)
}

// maxBedsPerAdd caps one "add beds" action, so a typo can't create hundreds.
const maxBedsPerAdd = 20

// AddBeds creates count new bed places in the room, each with a new
// permanent id (ids of retired beds are never reused), and raises the
// room's capacity to match.
func (s *RoomService) AddBeds(ctx context.Context, roomID uuid.UUID, count int) ([]*domain.Bed, error) {
	if count < 1 || count > maxBedsPerAdd {
		return nil, apperror.BadRequest(fmt.Sprintf("төсек-орын саны 1 мен %d аралығында болуы керек", maxBedsPerAdd))
	}
	beds, err := s.rooms.AddBeds(ctx, roomID, count)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("бөлме табылмады")
		}
		return nil, err
	}
	return beds, nil
}

// RetireBed records that a bed was physically removed from its room. The
// bed place keeps its id and history; it just stops counting toward the
// room's capacity. A bed someone is on must be freed first.
func (s *RoomService) RetireBed(ctx context.Context, bedID uuid.UUID) error {
	err := s.rooms.RetireBed(ctx, bedID)
	switch {
	case err == nil:
		return nil
	case errors.Is(err, repository.ErrNotFound):
		return apperror.NotFound("төсек-орын табылмады")
	case errors.Is(err, repository.ErrBedRetired):
		return apperror.Conflict("бұл төсек-орын бұрын алынып тасталған")
	case errors.Is(err, repository.ErrBedOccupied):
		return apperror.Conflict("төсек-орында тұрғын бар — алдымен оны басқа орынға ауыстырыңыз")
	case errors.Is(err, repository.ErrBedReserved):
		return apperror.Conflict("бұл төсек-орын өтініш бойынша брондалған")
	case errors.Is(err, repository.ErrLastBed):
		return apperror.Conflict("бөлмеде кемінде бір төсек-орын қалуы керек")
	}
	return err
}

// maxBedLabelLen matches beds.label VARCHAR(50).
const maxBedLabelLen = 50

// RenameBed changes a bed's label (its position name in the room); the
// bed's id and inventory number stay the same.
func (s *RoomService) RenameBed(ctx context.Context, bedID uuid.UUID, label string) (*domain.Bed, error) {
	label = strings.TrimSpace(label)
	if label == "" {
		return nil, apperror.BadRequest("төсек-орын белгісі міндетті")
	}
	if len([]rune(label)) > maxBedLabelLen {
		return nil, apperror.BadRequest(fmt.Sprintf("төсек-орын белгісі %d таңбадан аспауы керек", maxBedLabelLen))
	}
	err := s.rooms.RenameBed(ctx, bedID, label)
	switch {
	case err == nil:
	case errors.Is(err, repository.ErrNotFound):
		return nil, apperror.NotFound("төсек-орын табылмады")
	case errors.Is(err, repository.ErrBedRetired):
		return nil, apperror.Conflict("алынып тасталған төсек-орынның белгісін өзгертуге болмайды")
	case errors.Is(err, repository.ErrConflict):
		return nil, apperror.Conflict("бұл бөлмеде осындай белгісі бар төсек-орын бұрыннан бар")
	default:
		return nil, err
	}
	return s.rooms.GetBedByID(ctx, bedID)
}

// BedHistory returns the bed and every stay on it, newest first.
func (s *RoomService) BedHistory(ctx context.Context, bedID uuid.UUID) (*domain.Bed, []*domain.RoomResident, error) {
	bed, err := s.rooms.GetBedByID(ctx, bedID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, apperror.NotFound("төсек-орын табылмады")
		}
		return nil, nil, err
	}
	stays, err := s.rooms.ListBedHistory(ctx, bedID)
	if err != nil {
		return nil, nil, err
	}
	return bed, stays, nil
}

// maxBedServiceReasonLen caps the reason a bed is out of service.
const maxBedServiceReasonLen = 500

// maxBedActNumberLen matches bed_status_history.act_number VARCHAR(100).
const maxBedActNumberLen = 100

// SetBedStatus takes a bed out of service (repair — на ремонте,
// unavailable — временно недоступно) or returns it to service. Every such
// change cites an act (акт): its number and date are required, the scanned
// file optional; the act is the basis recorded in the bed's status log.
// Taking a bed out also needs a reason; until, the expected date it is
// back, is optional and may not be in the past. Returning to service clears
// both. A bed someone lives on or an application holds must be freed first.
func (s *RoomService) SetBedStatus(ctx context.Context, bedID uuid.UUID, status domain.BedServiceStatus,
	reason *string, until *time.Time, act domain.BedAct, actorID uuid.UUID) (*domain.Bed, error) {
	if !status.Valid() {
		return nil, apperror.BadRequest("төсек-орын күйі дұрыс емес")
	}
	act.Number = strings.TrimSpace(act.Number)
	if act.Number == "" || act.Date.IsZero() {
		return nil, apperror.BadRequest("актінің нөмірі мен күні міндетті")
	}
	if len([]rune(act.Number)) > maxBedActNumberLen {
		return nil, apperror.BadRequest(fmt.Sprintf("акт нөмірі %d таңбадан аспауы керек", maxBedActNumberLen))
	}
	if act.Date.Format(time.DateOnly) > time.Now().Format(time.DateOnly) {
		return nil, apperror.BadRequest("акт күні болашақта болмауы керек")
	}
	if act.FileURL != nil && strings.TrimSpace(*act.FileURL) == "" {
		act.FileURL = nil
	}
	ctx = domain.WithBedAct(domain.WithBedActor(ctx, actorID), act)
	if status == domain.BedInService {
		reason, until = nil, nil
	} else {
		if reason != nil {
			trimmed := strings.TrimSpace(*reason)
			reason = &trimmed
		}
		if reason == nil || *reason == "" {
			return nil, apperror.BadRequest("жөндеу немесе қолжетімсіздік себебі міндетті")
		}
		if len([]rune(*reason)) > maxBedServiceReasonLen {
			return nil, apperror.BadRequest(fmt.Sprintf("себеп %d таңбадан аспауы керек", maxBedServiceReasonLen))
		}
		if until != nil && until.Format(time.DateOnly) < time.Now().Format(time.DateOnly) {
			return nil, apperror.BadRequest("күтілетін аяқталу күні өткен күн болмауы керек")
		}
	}

	bed, err := s.rooms.SetBedServiceStatus(ctx, bedID, status, reason, until, actorID)
	switch {
	case err == nil:
		return bed, nil
	case errors.Is(err, repository.ErrNotFound):
		return nil, apperror.NotFound("төсек-орын табылмады")
	case errors.Is(err, repository.ErrBedRetired):
		return nil, apperror.Conflict("бұл төсек-орын алынып тасталған")
	case errors.Is(err, repository.ErrBedOccupied):
		return nil, apperror.Conflict("төсек-орында тұрғын бар — алдымен оны басқа орынға ауыстырыңыз")
	case errors.Is(err, repository.ErrBedReserved):
		return nil, apperror.Conflict("бұл төсек-орын өтініш бойынша брондалған")
	}
	return nil, err
}

// BedStatusHistory returns the bed and its status log, newest first.
func (s *RoomService) BedStatusHistory(ctx context.Context, bedID uuid.UUID) (*domain.Bed, []*domain.BedStatusChange, error) {
	bed, err := s.rooms.GetBedByID(ctx, bedID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, apperror.NotFound("төсек-орын табылмады")
		}
		return nil, nil, err
	}
	changes, err := s.rooms.ListBedStatusHistory(ctx, bedID)
	if err != nil {
		return nil, nil, err
	}
	return bed, changes, nil
}
