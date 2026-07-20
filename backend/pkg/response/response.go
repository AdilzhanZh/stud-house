package response

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"student-house/pkg/apperror"
	"student-house/pkg/reqlang"
)

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"data": data})
}

// Error inspects err for an *apperror.AppError and responds with its status
// and code; anything else is treated as an unexpected internal error. The
// message is translated into the caller's UI language (see
// middleware.DetectLanguage / pkg/reqlang) — every apperror.* call site is
// written in Kazakh, so this is what lets, e.g., a wrong-password error come
// back in Russian for a caller with the UI set to Russian.
func Error(c *gin.Context, err error) {
	lang := reqlang.Get(c)
	var appErr *apperror.AppError
	if errors.As(err, &appErr) {
		msg := apperror.Translate(appErr.Message, lang)
		c.JSON(appErr.Status, gin.H{"error": gin.H{"code": appErr.Code, "message": msg}})
		return
	}
	log.Printf("unexpected error on %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	msg := apperror.Translate("Күтпеген қате орын алды, қайталап көріңіз", lang)
	c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "internal_error", "message": msg}})
}
