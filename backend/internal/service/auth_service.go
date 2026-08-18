package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
	"unicode"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
	"student-house/pkg/hasher"
	"student-house/pkg/jwtutil"
)

// emailCheckTimeout bounds how long a registration request will wait on the
// email-domain-reachability DNS lookup before giving up — a slow or
// unreachable DNS server must never hang the registration endpoint.
const emailCheckTimeout = 3 * time.Second

type AuthService struct {
	users         repository.UserRepository
	profiles      repository.StudentProfileRepository
	refreshTokens repository.RefreshTokenRepository
	jwtSecret     string
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewAuthService(users repository.UserRepository, profiles repository.StudentProfileRepository, refreshTokens repository.RefreshTokenRepository, jwtSecret string, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		users:         users,
		profiles:      profiles,
		refreshTokens: refreshTokens,
		jwtSecret:     jwtSecret,
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

// emailDomainReachable is a best-effort check that an email's domain can
// plausibly receive mail: it looks for an MX record, falling back to a plain
// A/AAAA record (mail can be delivered there per RFC 5321 when no MX
// exists). It does not (and cannot, without actually sending mail) confirm
// the mailbox itself exists — this only catches typo'd/nonexistent domains,
// which is what RegisterStudent uses it for.
func emailDomainReachable(ctx context.Context, email string) bool {
	at := strings.LastIndexByte(email, '@')
	if at < 0 || at == len(email)-1 {
		return false
	}
	emailDomain := email[at+1:]

	checkCtx, cancel := context.WithTimeout(ctx, emailCheckTimeout)
	defer cancel()

	if records, err := net.DefaultResolver.LookupMX(checkCtx, emailDomain); err == nil && len(records) > 0 {
		return true
	}
	if _, err := net.DefaultResolver.LookupHost(checkCtx, emailDomain); err == nil {
		return true
	}
	return false
}

// isReplaceableStudent reports whether an existing user row is a rejected
// student registration and can therefore be silently discarded by a new
// registration attempt reusing the same email/IIN. DecideStudentApproval
// deletes a rejected row outright rather than leaving one behind, so this is
// defensive/historical — it only matters for rows created before that
// behavior existed. Either way a rejected row never granted login access, so
// its email/IIN must not stay permanently reserved.
func isReplaceableStudent(u *domain.User) bool {
	return u.Role == domain.RoleStudent && u.ApprovalStatus == domain.ApprovalRejected
}

func isValidIIN(iin string) bool {
	if len(iin) != 12 {
		return false
	}
	for _, r := range iin {
		if !unicode.IsDigit(r) {
			return false
		}
	}
	return true
}

// studentRegistrationInput bundles the fields collected by both the public
// self-registration form (AuthService.RegisterStudent) and the admin/manager
// "create student" form (UserService.CreateStudent) — the two flows share
// every validation and duplicate-check rule and differ only in the
// approval_status the resulting account gets.
type studentRegistrationInput struct {
	FullName       string
	Email          string
	Phone          string
	Password       string
	IIN            string
	Gender         domain.Gender
	Course         int16
	AcademicDegree domain.AcademicDegree
}

// createStudentAccount validates in, frees up any stale rejected row reusing
// the same email/IIN (see isReplaceableStudent), and creates the user +
// student_profiles rows with the given approvalStatus — the one thing the
// two call sites (self-registration vs. admin/manager creation) disagree
// about.
func createStudentAccount(
	ctx context.Context,
	users repository.UserRepository,
	profiles repository.StudentProfileRepository,
	in studentRegistrationInput,
	approvalStatus domain.ApprovalStatus,
) (*domain.User, error) {
	if in.FullName == "" || in.Email == "" || in.Password == "" || in.IIN == "" {
		return nil, apperror.BadRequest("аты-жөні, email, ЖСН (ИИН) және құпия сөз міндетті")
	}
	if len(in.Password) < 8 {
		return nil, apperror.BadRequest("құпия сөз кемінде 8 таңбадан тұруы керек")
	}
	if !isValidIIN(in.IIN) {
		return nil, apperror.BadRequest("ЖСН (ИИН) 12 таңбалы сан болуы керек")
	}
	if !in.Gender.Valid() {
		return nil, apperror.BadRequest("жынысын таңдаңыз")
	}
	if !in.AcademicDegree.Valid() {
		return nil, apperror.BadRequest("оқу деңгейін (бакалавриат/магистратура) таңдаңыз")
	}
	if in.Course < 1 || in.Course > in.AcademicDegree.MaxCourse() {
		return nil, apperror.BadRequest(fmt.Sprintf("курс 1 мен %d аралығында болуы керек", in.AcademicDegree.MaxCourse()))
	}

	existingByEmail, err := users.GetByEmail(ctx, in.Email)
	if err == nil {
		if !isReplaceableStudent(existingByEmail) {
			return nil, apperror.Conflict("бұл email-мен пайдаланушы бұрыннан бар")
		}
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	existingByIIN, err := users.GetByIIN(ctx, in.IIN)
	if err == nil {
		if !isReplaceableStudent(existingByIIN) {
			return nil, apperror.Conflict("бұл ЖСН (ИИН) бұрыннан тіркелген")
		}
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	// A rejected self-registration never gained login access, so it must not
	// permanently squat the email/IIN it used — clear it out so the applicant
	// can try again instead of being told the email/IIN "already exists".
	if existingByEmail != nil {
		if err := users.Delete(ctx, existingByEmail.ID); err != nil {
			return nil, err
		}
	}
	if existingByIIN != nil && (existingByEmail == nil || existingByIIN.ID != existingByEmail.ID) {
		if err := users.Delete(ctx, existingByIIN.ID); err != nil {
			return nil, err
		}
	}

	passwordHash, err := hasher.HashPassword(in.Password)
	if err != nil {
		return nil, err
	}

	gender, course, academicDegree := in.Gender, in.Course, in.AcademicDegree
	user := &domain.User{
		FullName:       in.FullName,
		Email:          in.Email,
		Phone:          in.Phone,
		IIN:            &in.IIN,
		PasswordHash:   passwordHash,
		Role:           domain.RoleStudent,
		ApprovalStatus: approvalStatus,
	}
	if err := users.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("бұл email немесе ЖСН (ИИН) бұрыннан тіркелген")
		}
		return nil, err
	}
	if err := profiles.Upsert(ctx, &domain.StudentProfile{UserID: user.ID, Gender: &gender, Course: &course, AcademicDegree: &academicDegree}); err != nil {
		return nil, err
	}
	return user, nil
}

// RegisterStudent is the public, unauthenticated registration path (there is
// also UserService.CreateStudent, for an admin/manager creating an account
// directly). The new account starts ApprovalPending — it cannot log in (see
// Login) until a manager/admin approves it via
// UserService.DecideStudentApproval.
//
// Unless skipEmailCheck is set, the email's domain is checked for
// reachability first (see emailDomainReachable) and a distinct
// apperror.Code "email_unverifiable" is returned if it looks bogus — the
// frontend offers the applicant a choice to go back and fix it, or resubmit
// with skipEmailCheck=true to register anyway. This is a best-effort typo
// catcher, not a mailbox-existence check, and registration is never blocked
// on it if the applicant insists.
func (s *AuthService) RegisterStudent(ctx context.Context, fullName, email, phone, password, iin string, gender domain.Gender, course int16, academicDegree domain.AcademicDegree, skipEmailCheck bool) (*domain.User, error) {
	if !skipEmailCheck && email != "" && !emailDomainReachable(ctx, email) {
		return nil, apperror.New(http.StatusUnprocessableEntity, "email_unverifiable", "көрсетілген email мекенжайы табылмады, тексеріңіз")
	}

	return createStudentAccount(ctx, s.users, s.profiles, studentRegistrationInput{
		FullName: fullName, Email: email, Phone: phone, Password: password, IIN: iin,
		Gender: gender, Course: course, AcademicDegree: academicDegree,
	}, domain.ApprovalPending)
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

// Login accepts either a 12-digit IIN (how students log in — an IIN is the
// one identifier every student is guaranteed to have, since email is no
// longer verified at registration) or an email (how admin/manager log in,
// since they have no IIN).
func (s *AuthService) Login(ctx context.Context, login, password string) (*TokenPair, *domain.User, error) {
	var user *domain.User
	var err error
	if isValidIIN(login) {
		user, err = s.users.GetByIIN(ctx, login)
	} else {
		user, err = s.users.GetByEmail(ctx, login)
	}
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, apperror.Unauthorized("логин немесе құпия сөз қате")
		}
		return nil, nil, err
	}

	if err := hasher.ComparePassword(user.PasswordHash, password); err != nil {
		return nil, nil, apperror.Unauthorized("логин немесе құпия сөз қате")
	}

	// Only role=student is gated by manager approval — admin/manager accounts
	// are always created directly by an admin, already trusted and approved
	// at creation.
	if user.Role == domain.RoleStudent {
		switch user.ApprovalStatus {
		case domain.ApprovalPending:
			return nil, nil, apperror.Forbidden("тіркелуіңіз әлі менеджердің растауын күтуде")
		case domain.ApprovalRejected:
			return nil, nil, apperror.Forbidden("тіркелу өтініші қабылданбады, менеджерге хабарласыңыз")
		}
	}

	pair, err := s.issueTokenPair(ctx, user)
	if err != nil {
		return nil, nil, err
	}
	return pair, user, nil
}

func (s *AuthService) issueTokenPair(ctx context.Context, user *domain.User) (*TokenPair, error) {
	accessToken, err := jwtutil.NewAccessToken(s.jwtSecret, s.accessTTL, user.ID, user.Role, user.IsCommitteeMember, user.IsChairperson)
	if err != nil {
		return nil, err
	}

	refreshToken, err := jwtutil.NewRefreshToken()
	if err != nil {
		return nil, err
	}

	rt := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: jwtutil.HashRefreshToken(refreshToken),
		ExpiresAt: time.Now().Add(s.refreshTTL),
	}
	if err := s.refreshTokens.Create(ctx, rt); err != nil {
		return nil, err
	}

	return &TokenPair{AccessToken: accessToken, RefreshToken: refreshToken}, nil
}

// Refresh rotates the refresh token: the old one is revoked and a new pair is issued.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*TokenPair, error) {
	hash := jwtutil.HashRefreshToken(refreshToken)
	rt, err := s.refreshTokens.GetByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.Unauthorized("refresh token жарамсыз")
		}
		return nil, err
	}
	if rt.RevokedAt != nil || time.Now().After(rt.ExpiresAt) {
		return nil, apperror.Unauthorized("refresh token мерзімі өткен немесе кері қайтарылған")
	}

	user, err := s.users.GetByID(ctx, rt.UserID)
	if err != nil {
		return nil, err
	}

	if err := s.refreshTokens.Revoke(ctx, rt.ID); err != nil {
		return nil, err
	}

	return s.issueTokenPair(ctx, user)
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	hash := jwtutil.HashRefreshToken(refreshToken)
	rt, err := s.refreshTokens.GetByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil
		}
		return err
	}
	return s.refreshTokens.Revoke(ctx, rt.ID)
}
