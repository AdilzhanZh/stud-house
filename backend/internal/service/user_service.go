package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
	"student-house/pkg/hasher"
	"student-house/pkg/mailer"
)

type UserService struct {
	users    repository.UserRepository
	profiles repository.StudentProfileRepository
	mailer   *mailer.Mailer
}

func NewUserService(users repository.UserRepository, profiles repository.StudentProfileRepository, m *mailer.Mailer) *UserService {
	return &UserService{users: users, profiles: profiles, mailer: m}
}

// CreateUser is admin-only: it can create admin/manager, but never student —
// students only ever self-register via AuthService.RegisterStudent, per spec
// ("Админ студенттен басқа рөлдерге жататын пайдаланушыларды жүйеге өзі
// тіркейді"). Committee membership isn't set here — admin elects a manager
// onto the committee afterward via SetCommitteeMember.
func (s *UserService) CreateUser(ctx context.Context, fullName, email, phone, password string, role domain.Role) (*domain.User, error) {
	if !role.Valid() {
		return nil, apperror.BadRequest("рөл жарамсыз")
	}
	if role == domain.RoleStudent {
		return nil, apperror.BadRequest("студенттер бұл арқылы емес, /auth/register арқылы өздері тіркелуі керек")
	}
	if role == domain.RoleAdmin {
		exists, err := s.adminAlreadyExists(ctx, nil)
		if err != nil {
			return nil, err
		}
		if exists {
			return nil, apperror.Conflict("жүйеде тек бір ғана админ бола алады")
		}
	}
	if fullName == "" || email == "" || password == "" {
		return nil, apperror.BadRequest("аты-жөні, email және құпия сөз міндетті")
	}
	if len(password) < 8 {
		return nil, apperror.BadRequest("құпия сөз кемінде 8 таңбадан тұруы керек")
	}

	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, apperror.Conflict("бұл email-мен пайдаланушы бұрыннан бар")
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	passwordHash, err := hasher.HashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		FullName:       fullName,
		Email:          email,
		Phone:          phone,
		PasswordHash:   passwordHash,
		Role:           role,
		ApprovalStatus: domain.ApprovalApproved,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("бұл email-мен пайдаланушы бұрыннан бар")
		}
		return nil, err
	}
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	user, err := s.users.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("пайдаланушы табылмады")
		}
		return nil, err
	}
	return user, nil
}

// adminAlreadyExists reports whether an admin exists other than excludeID —
// the system only ever allows a single admin account.
func (s *UserService) adminAlreadyExists(ctx context.Context, excludeID *uuid.UUID) (bool, error) {
	admins, err := s.users.ListByRole(ctx, domain.RoleAdmin)
	if err != nil {
		return false, err
	}
	for _, a := range admins {
		if excludeID == nil || a.ID != *excludeID {
			return true, nil
		}
	}
	return false, nil
}

// UpdateRole is admin-only. Changing a user's role away from manager
// implicitly clears both the committee-member and chairperson flags, since
// neither makes sense off that role.
func (s *UserService) UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) error {
	if !role.Valid() {
		return apperror.BadRequest("рөл жарамсыз")
	}
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if role == domain.RoleAdmin {
		exists, err := s.adminAlreadyExists(ctx, &id)
		if err != nil {
			return err
		}
		if exists {
			return apperror.Conflict("жүйеде тек бір ғана админ бола алады")
		}
	}
	if err := s.users.UpdateRole(ctx, id, role); err != nil {
		return err
	}
	if role != domain.RoleManager {
		if user.IsChairperson {
			if err := s.users.UpdateChairperson(ctx, id, false); err != nil {
				return err
			}
		}
		if user.IsCommitteeMember {
			return s.users.UpdateCommitteeMember(ctx, id, false)
		}
	}
	return nil
}

// SetCommitteeMember is admin-only ("менеджерлер арасынан админ сайлайды") —
// only valid for users with role=manager. Revoking membership implicitly
// clears the chairperson flag too.
func (s *UserService) SetCommitteeMember(ctx context.Context, id uuid.UUID, isCommitteeMember bool) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if user.Role != domain.RoleManager {
		return apperror.BadRequest("комиссия мүшелігі тек менеджерге ғана тағайындалады")
	}
	if err := s.users.UpdateCommitteeMember(ctx, id, isCommitteeMember); err != nil {
		return err
	}
	if !isCommitteeMember && user.IsChairperson {
		return s.users.UpdateChairperson(ctx, id, false)
	}
	return nil
}

// SetChairperson is admin-only and only valid for users already elected onto
// the committee (is_committee_member = true) — chairperson is a further
// flag on top of that, and only one user may hold it at a time.
func (s *UserService) SetChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if isChairperson && !user.IsCommitteeMember {
		return apperror.BadRequest("төраға тек комиссия мүшесіне ғана тағайындалады")
	}
	return s.users.UpdateChairperson(ctx, id, isChairperson)
}

// UpdateAvatar sets or clears (avatarURL == "") the caller's profile picture
// URL. Access (self, or admin/manager) is checked by the handler, same as
// UpsertStudentProfile.
func (s *UserService) UpdateAvatar(ctx context.Context, id uuid.UUID, avatarURL string) (*domain.User, error) {
	var url *string
	if avatarURL != "" {
		url = &avatarURL
	}
	if err := s.users.UpdateAvatar(ctx, id, url); err != nil {
		return nil, err
	}
	return s.GetByID(ctx, id)
}

func (s *UserService) ListCommitteeMembers(ctx context.Context) ([]*domain.User, error) {
	return s.users.ListCommitteeMembers(ctx)
}

// List is for the admin panel's user list: optionally filtered by role.
func (s *UserService) List(ctx context.Context, role *domain.Role) ([]*domain.User, error) {
	if role != nil && !role.Valid() {
		return nil, apperror.BadRequest("рөл бойынша сүзгі жарамсыз")
	}
	return s.users.List(ctx, role)
}

func (s *UserService) UpsertStudentProfile(ctx context.Context, userID uuid.UUID, gender *domain.Gender, course *int16, academicDegree *domain.AcademicDegree) error {
	user, err := s.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if user.Role != domain.RoleStudent {
		return apperror.BadRequest("профиль (жынысы/курсы) тек студентке ғана орнатылады")
	}
	if gender != nil && !gender.Valid() {
		return apperror.BadRequest("жынысы жарамсыз")
	}
	if academicDegree != nil && !academicDegree.Valid() {
		return apperror.BadRequest("оқу деңгейі жарамсыз")
	}
	if course != nil {
		effectiveDegree := academicDegree
		if effectiveDegree == nil {
			if existing, err := s.profiles.GetByUserID(ctx, userID); err == nil {
				effectiveDegree = existing.AcademicDegree
			} else if !errors.Is(err, repository.ErrNotFound) {
				return err
			}
		}
		maxCourse := domain.DegreeBachelor.MaxCourse()
		if effectiveDegree != nil {
			maxCourse = effectiveDegree.MaxCourse()
		}
		if *course < 1 || *course > maxCourse {
			return apperror.BadRequest(fmt.Sprintf("курс 1 мен %d аралығында болуы керек", maxCourse))
		}
	}
	return s.profiles.Upsert(ctx, &domain.StudentProfile{UserID: userID, Gender: gender, Course: course, AcademicDegree: academicDegree})
}

// ListPendingStudents is manager/admin-only: self-registered students
// waiting for approval before they can log in.
func (s *UserService) ListPendingStudents(ctx context.Context) ([]*domain.User, error) {
	return s.users.ListPendingStudents(ctx)
}

// DecideStudentApproval is manager/admin-only. approve grants login access;
// reject permanently blocks it (the account stays, matching how rejected
// applications aren't deleted elsewhere in this codebase).
func (s *UserService) DecideStudentApproval(ctx context.Context, id uuid.UUID, approve bool) error {
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if user.Role != domain.RoleStudent {
		return apperror.BadRequest("тіркелуді растау тек студенттерге қолданылады")
	}
	if user.ApprovalStatus != domain.ApprovalPending {
		return apperror.Conflict("бұл тіркелу әлдеқашан қаралған")
	}
	status := domain.ApprovalRejected
	if approve {
		status = domain.ApprovalApproved
	}
	if err := s.users.UpdateApprovalStatus(ctx, id, status); err != nil {
		return err
	}

	// Email is best-effort: a slow/failing SMTP send must never fail (or even
	// delay) the approval decision itself, so it runs in its own goroutine
	// with the error only logged — the same trade-off notifier.Notifier makes
	// for in-app notifications elsewhere in this codebase.
	subject := "Тіркелуіңіз расталды — Student House"
	body := "Құрметті " + user.FullName + ",\n\n" +
		"Сіздің Student House жүйесіндегі тіркелу өтінішіңізді менеджер растады. " +
		"Енді жүйеге email және құпия сөзіңізбен кіре аласыз.\n\nСтудент House"
	if !approve {
		subject = "Тіркелу өтінішіңіз қабылданбады — Student House"
		body = "Құрметті " + user.FullName + ",\n\n" +
			"Сіздің Student House жүйесіндегі тіркелу өтінішіңіз менеджер тарапынан қабылданбады. " +
			"Толық ақпарат алу үшін менеджерге хабарласыңыз.\n\nСтудент House"
	}
	go func(email, subject, body string) {
		if err := s.mailer.Send(email, subject, body); err != nil {
			log.Printf("failed to send approval-decision email to %s: %v", email, err)
		}
	}(user.Email, subject, body)

	return nil
}

// SetUserPassword is admin-only. Passwords are stored as bcrypt hashes and
// cannot be recovered or displayed — this lets an admin reset a user's access
// without ever seeing (or the system storing) the plaintext password.
func (s *UserService) SetUserPassword(ctx context.Context, id uuid.UUID, newPassword string) error {
	if len(newPassword) < 8 {
		return apperror.BadRequest("құпия сөз кемінде 8 таңбадан тұруы керек")
	}
	if _, err := s.GetByID(ctx, id); err != nil {
		return err
	}
	passwordHash, err := hasher.HashPassword(newPassword)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(ctx, id, passwordHash)
}

// ChangeOwnPassword lets any authenticated user change their own password.
// Unlike SetUserPassword (admin-only, no old-password check — an admin
// resetting a locked-out user's access may not know their old password),
// this verifies currentPassword against the stored hash first, since the
// caller here already has full account access and this is a self-service
// action rather than a recovery one.
func (s *UserService) ChangeOwnPassword(ctx context.Context, id uuid.UUID, currentPassword, newPassword string) error {
	if len(newPassword) < 8 {
		return apperror.BadRequest("құпия сөз кемінде 8 таңбадан тұруы керек")
	}
	user, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if err := hasher.ComparePassword(user.PasswordHash, currentPassword); err != nil {
		return apperror.BadRequest("ағымдағы құпия сөз қате")
	}
	passwordHash, err := hasher.HashPassword(newPassword)
	if err != nil {
		return err
	}
	return s.users.UpdatePassword(ctx, id, passwordHash)
}

// DeleteUser is admin-only. Callers must reject self-deletion before calling
// this (an admin locking themselves out has no recovery path in this app).
func (s *UserService) DeleteUser(ctx context.Context, id uuid.UUID) error {
	if _, err := s.GetByID(ctx, id); err != nil {
		return err
	}
	if err := s.users.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return apperror.Conflict("пайдаланушыны жоюға болмайды, ол басқа жазбаларда (өтініш, келісімшарт, дауыс және т.б.) қолданылады")
		}
		return err
	}
	return nil
}

// GetStudentProfile never 404s: a student's gender/course profile is unset
// (nil fields), not absent, until they save it for the first time via
// UpsertStudentProfile — this lets the profile form always render instead of
// dead-ending on a not-found error for students without a row yet (e.g.
// accounts registered before the profile-at-registration flow existed).
func (s *UserService) GetStudentProfile(ctx context.Context, userID uuid.UUID) (*domain.StudentProfile, error) {
	profile, err := s.profiles.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return &domain.StudentProfile{UserID: userID}, nil
		}
		return nil, err
	}
	return profile, nil
}
