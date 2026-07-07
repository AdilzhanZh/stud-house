package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

// RequireRole must run after RequireAuth. It allows the request through only
// if the authenticated user's role is one of allowed.
func RequireRole(allowed ...domain.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := Role(c)
		if !ok {
			response.Error(c, apperror.Unauthorized("authentication required"))
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}
		for _, r := range allowed {
			if role == r {
				c.Next()
				return
			}
		}
		response.Error(c, apperror.Forbidden("you do not have permission to perform this action"))
		c.AbortWithStatus(http.StatusForbidden)
	}
}
