package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/pkg/jwtutil"
	"student-house/pkg/response"
)

const (
	ctxUserID        = "user_id"
	ctxRole          = "role"
	ctxIsChairperson = "is_chairperson"
)

// RequireAuth validates the JWT access token from the Authorization header
// and stores its claims in the gin context for downstream handlers/middleware.
func RequireAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			response.Error(c, jwtutil.ErrInvalidToken)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		claims, err := jwtutil.ParseAccessToken(jwtSecret, parts[1])
		if err != nil {
			response.Error(c, jwtutil.ErrInvalidToken)
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		c.Set(ctxUserID, claims.UserID)
		c.Set(ctxRole, claims.Role)
		c.Set(ctxIsChairperson, claims.IsChairperson)
		c.Next()
	}
}

func UserID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get(ctxUserID)
	if !ok {
		return uuid.UUID{}, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

func Role(c *gin.Context) (domain.Role, bool) {
	v, ok := c.Get(ctxRole)
	if !ok {
		return "", false
	}
	role, ok := v.(domain.Role)
	return role, ok
}

func IsChairperson(c *gin.Context) bool {
	v, ok := c.Get(ctxIsChairperson)
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}
