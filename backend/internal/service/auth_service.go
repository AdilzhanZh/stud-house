package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"time"
	"unicode"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
	"student-house/pkg/hasher"
	"student-house/pkg/jwtutil"
	"student-house/pkg/mailer"
)

const emailVerificationTTL = 15 * time.Minute

type AuthService struct {
	users         repository.UserRepository
	profiles      repository.StudentProfileRepository
	refreshTokens repository.RefreshTokenRepository
	mailer        *mailer.Mailer
	jwtSecret     string
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewAuthService(users repository.UserRepository, profiles repository.StudentProfileRepository, refreshTokens repository.RefreshTokenRepository, m *mailer.Mailer, jwtSecret string, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		users:         users,
		profiles:      profiles,
		refreshTokens: refreshTokens,
		mailer:        m,
		jwtSecret:     jwtSecret,
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

// generateVerificationCode returns a random 6-digit numeric code as a
// zero-padded string (e.g. "004821") using a CSPRNG — this is emailed to the
// student and must be guessed-resistant, unlike a plain math/rand sequence.
func generateVerificationCode() (string, error) {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	n := (uint32(buf[0])<<24 | uint32(buf[1])<<16 | uint32(buf[2])<<8 | uint32(buf[3])) % 1000000
	return fmt.Sprintf("%06d", n), nil
}

func (s *AuthService) sendVerificationEmail(user *domain.User, code string) {
	subject := "Email-ды растау коды — Student House"
	body := "Құрметті " + user.FullName + ",\n\n" +
		"Student House жүйесінде тіркелу үшін растау коды: " + code + "\n\n" +
		"Код 15 минут ішінде жарамды.\n\nСтудент House"
	if err := s.mailer.Send(user.Email, subject, body); err != nil {
		log.Printf("failed to send verification email to %s: %v", user.Email, err)
	}
}

// isReplaceableRejectedStudent reports whether an existing user row is a
// rejected self-registration and can therefore be silently discarded by a
// new registration attempt reusing the same email/IIN — a rejected applicant
// never became a real account (couldn't log in), so their email/IIN
// shouldn't stay permanently reserved.
func isReplaceableRejectedStudent(u *domain.User) bool {
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

// RegisterStudent is the only public, unauthenticated registration path.
// Every other role must be created by an admin via UserService.CreateUser.
// The new account starts ApprovalPending — it cannot log in (see Login)
// until a manager/admin approves it via UserService.DecideStudentApproval.
// If the email/IIN belongs to a previously rejected student registration,
// that stale row is replaced rather than blocking the new attempt (see
// isReplaceableRejectedStudent).
func (s *AuthService) RegisterStudent(ctx context.Context, fullName, email, phone, password, iin string, gender domain.Gender, course int16, academicDegree domain.AcademicDegree) (*domain.User, error) {
	if fullName == "" || email == "" || password == "" || iin == "" {
		return nil, apperror.BadRequest("аты-жөні, email, ЖСН (ИИН) және құпия сөз міндетті")
	}
	if len(password) < 8 {
		return nil, apperror.BadRequest("құпия сөз кемінде 8 таңбадан тұруы керек")
	}
	if !isValidIIN(iin) {
		return nil, apperror.BadRequest("ЖСН (ИИН) 12 таңбалы сан болуы керек")
	}
	if !gender.Valid() {
		return nil, apperror.BadRequest("жынысын таңдаңыз")
	}
	if !academicDegree.Valid() {
		return nil, apperror.BadRequest("оқу деңгейін (бакалавриат/магистратура) таңдаңыз")
	}
	if course < 1 || course > academicDegree.MaxCourse() {
		return nil, apperror.BadRequest(fmt.Sprintf("курс 1 мен %d аралығында болуы керек", academicDegree.MaxCourse()))
	}

	existingByEmail, err := s.users.GetByEmail(ctx, email)
	if err == nil {
		if !isReplaceableRejectedStudent(existingByEmail) {
			return nil, apperror.Conflict("бұл email-мен пайдаланушы бұрыннан бар")
		}
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	existingByIIN, err := s.users.GetByIIN(ctx, iin)
	if err == nil {
		if !isReplaceableRejectedStudent(existingByIIN) {
			return nil, apperror.Conflict("бұл ЖСН (ИИН) бұрыннан тіркелген")
		}
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	// A rejected self-registration never gained login access, so it must not
	// permanently squat the email/IIN it used — clear it out so the applicant
	// can try again instead of being told the email/IIN "already exists".
	if existingByEmail != nil {
		if err := s.users.Delete(ctx, existingByEmail.ID); err != nil {
			return nil, err
		}
	}
	if existingByIIN != nil && (existingByEmail == nil || existingByIIN.ID != existingByEmail.ID) {
		if err := s.users.Delete(ctx, existingByIIN.ID); err != nil {
			return nil, err
		}
	}

	passwordHash, err := hasher.HashPassword(password)
	if err != nil {
		return nil, err
	}

	code, err := generateVerificationCode()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(emailVerificationTTL)

	user := &domain.User{
		FullName:                   fullName,
		Email:                      email,
		Phone:                      phone,
		IIN:                        &iin,
		PasswordHash:               passwordHash,
		Role:                       domain.RoleStudent,
		ApprovalStatus:             domain.ApprovalPending,
		EmailVerificationCode:      &code,
		EmailVerificationExpiresAt: &expiresAt,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("бұл email немесе ЖСН (ИИН) бұрыннан тіркелген")
		}
		return nil, err
	}
	if err := s.profiles.Upsert(ctx, &domain.StudentProfile{UserID: user.ID, Gender: &gender, Course: &course, AcademicDegree: &academicDegree}); err != nil {
		return nil, err
	}
	s.sendVerificationEmail(user, code)
	return user, nil
}

// VerifyEmail checks the code emailed at registration (or by
// ResendVerificationCode) and marks the account verified. Login is blocked
// until this succeeds, independently of the manager-approval gate.
func (s *AuthService) VerifyEmail(ctx context.Context, email, code string) error {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.BadRequest("мұндай email-мен пайдаланушы табылмады")
		}
		return err
	}
	if user.EmailVerifiedAt != nil {
		return apperror.Conflict("email бұрыннан расталған")
	}
	if user.EmailVerificationCode == nil || user.EmailVerificationExpiresAt == nil ||
		code != *user.EmailVerificationCode || time.Now().After(*user.EmailVerificationExpiresAt) {
		return apperror.BadRequest("код қате немесе мерзімі өткен")
	}
	return s.users.MarkEmailVerified(ctx, user.ID)
}

// ResendVerificationCode issues and emails a fresh code, replacing any
// previous one (e.g. the first email was lost or the old code expired).
func (s *AuthService) ResendVerificationCode(ctx context.Context, email string) error {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.BadRequest("мұндай email-мен пайдаланушы табылмады")
		}
		return err
	}
	if user.EmailVerifiedAt != nil {
		return apperror.Conflict("email бұрыннан расталған")
	}
	code, err := generateVerificationCode()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(emailVerificationTTL)
	if err := s.users.SetEmailVerificationCode(ctx, user.ID, code, expiresAt); err != nil {
		return err
	}
	s.sendVerificationEmail(user, code)
	return nil
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*TokenPair, *domain.User, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, apperror.Unauthorized("email немесе құпия сөз қате")
		}
		return nil, nil, err
	}

	if err := hasher.ComparePassword(user.PasswordHash, password); err != nil {
		return nil, nil, apperror.Unauthorized("email немесе құпия сөз қате")
	}

	// Only role=student is gated by email verification/approval —
	// admin/manager accounts are always created directly by an admin,
	// already trusted and marked verified/approved at creation.
	if user.Role == domain.RoleStudent {
		if user.EmailVerifiedAt == nil {
			return nil, nil, apperror.Forbidden("алдымен email-ды растаңыз")
		}
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
