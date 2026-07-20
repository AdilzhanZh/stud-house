// Package reqlang carries the caller's UI language (kk/ru/en) through a
// gin.Context for the lifetime of a request. It exists as its own tiny
// package (no dependency beyond gin) purely to break an import cycle:
// internal/http/middleware sets the language (it already imports
// pkg/response to write error bodies), and pkg/response reads it back to
// translate apperror messages before writing them — if either package
// exposed this directly, the other would have to import it back.
package reqlang

import "github.com/gin-gonic/gin"

const ctxKey = "lang"

// Set stores the request's language, as detected by
// middleware.DetectLanguage, on the gin context.
func Set(c *gin.Context, lang string) {
	c.Set(ctxKey, lang)
}

// Get returns the request's language, defaulting to "kk" — the canonical
// language every apperror.* call site is written in — if it was never set
// (e.g. in tests that construct a bare gin.Context).
func Get(c *gin.Context) string {
	v, ok := c.Get(ctxKey)
	if !ok {
		return "kk"
	}
	s, _ := v.(string)
	if s == "" {
		return "kk"
	}
	return s
}
