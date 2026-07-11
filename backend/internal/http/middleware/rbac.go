package middleware

import (
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
			response.Error(c, apperror.Unauthorized("авторизация қажет"))
			c.Abort()
			return
		}
		for _, r := range allowed {
			if role == r {
				c.Next()
				return
			}
		}
		// c.AbortWithStatus after response.Error already wrote the status via
		// c.JSON would be a redundant second header write (harmless here since
		// the codes match, but still logs gin's "headers already written"
		// warning) — c.Abort() alone is enough to stop the chain.
		response.Error(c, apperror.Forbidden("бұл әрекетті орындауға құқығыңыз жоқ"))
		c.Abort()
	}
}

// RequireCommitteeMember must run after RequireAuth. Committee membership is
// an admin-toggled flag on a manager, not a separate role, so this checks
// the flag from the JWT claims instead of Role().
func RequireCommitteeMember() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !IsCommitteeMember(c) {
			response.Error(c, apperror.Forbidden("бұл әрекетті орындауға құқығыңыз жоқ"))
			c.Abort()
			return
		}
		c.Next()
	}
}
