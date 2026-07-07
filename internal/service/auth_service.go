package service

import (
	"context"
	"errors"
	"time"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
	"student-house/pkg/hasher"
	"student-house/pkg/jwtutil"
)

type AuthService struct {
	users         repository.UserRepository
	refreshTokens repository.RefreshTokenRepository
	jwtSecret     string
	accessTTL     time.Duration
	refreshTTL    time.Duration
}

func NewAuthService(users repository.UserRepository, refreshTokens repository.RefreshTokenRepository, jwtSecret string, accessTTL, refreshTTL time.Duration) *AuthService {
	return &AuthService{
		users:         users,
		refreshTokens: refreshTokens,
		jwtSecret:     jwtSecret,
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

// RegisterStudent is the only public, unauthenticated registration path.
// Every other role must be created by an admin via UserService.CreateUser.
func (s *AuthService) RegisterStudent(ctx context.Context, fullName, email, phone, password string) (*domain.User, error) {
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
		Role:         domain.RoleStudent,
	}
	if err := s.users.Create(ctx, user); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return nil, apperror.Conflict("a user with this email already exists")
		}
		return nil, err
	}
	return user, nil
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*TokenPair, *domain.User, error) {
	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil, apperror.Unauthorized("invalid email or password")
		}
		return nil, nil, err
	}

	if err := hasher.ComparePassword(user.PasswordHash, password); err != nil {
		return nil, nil, apperror.Unauthorized("invalid email or password")
	}

	pair, err := s.issueTokenPair(ctx, user)
	if err != nil {
		return nil, nil, err
	}
	return pair, user, nil
}

func (s *AuthService) issueTokenPair(ctx context.Context, user *domain.User) (*TokenPair, error) {
	accessToken, err := jwtutil.NewAccessToken(s.jwtSecret, s.accessTTL, user.ID, user.Role, user.IsChairperson)
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
			return nil, apperror.Unauthorized("invalid refresh token")
		}
		return nil, err
	}
	if rt.RevokedAt != nil || time.Now().After(rt.ExpiresAt) {
		return nil, apperror.Unauthorized("refresh token expired or revoked")
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
