package middleware

import (
	"github.com/gin-gonic/gin"

	"student-house/pkg/reqlang"
)

var supportedLangs = map[string]bool{"kk": true, "ru": true, "en": true}

// DetectLanguage reads the caller's UI language off the Accept-Language
// header — sent verbatim by the frontend as exactly one of "kk"/"ru"/"en"
// (not full RFC 4647 content negotiation, since the frontend always sends
// one of its own three supported codes) — and stores it via reqlang so
// pkg/response can translate apperror messages into it before responding.
// Registered globally (not per-route) so it also covers public endpoints,
// e.g. a wrong password on POST /auth/login, which runs before any auth
// middleware.
func DetectLanguage() gin.HandlerFunc {
	return func(c *gin.Context) {
		lang := c.GetHeader("Accept-Language")
		if !supportedLangs[lang] {
			lang = "kk"
		}
		reqlang.Set(c, lang)
		c.Next()
	}
}
