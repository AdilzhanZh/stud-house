package jwtutil

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"student-house/internal/domain"
)

var ErrInvalidToken = errors.New("invalid or expired access token")

type Claims struct {
	UserID        uuid.UUID   `json:"sub"`
	Role          domain.Role `json:"role"`
	IsChairperson bool        `json:"is_chairperson"`
	jwt.RegisteredClaims
}

func NewAccessToken(secret string, ttl time.Duration, userID uuid.UUID, role domain.Role, isChairperson bool) (string, error) {
	claims := Claims{
		UserID:        userID,
		Role:          role,
		IsChairperson: isChairperson,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ttl)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseAccessToken(secret string, tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	return claims, nil
}
