package response

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"student-house/pkg/apperror"
)

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"data": data})
}

// Error inspects err for an *apperror.AppError and responds with its status
// and code; anything else is treated as an unexpected internal error.
func Error(c *gin.Context, err error) {
	var appErr *apperror.AppError
	if errors.As(err, &appErr) {
		c.JSON(appErr.Status, gin.H{"error": gin.H{"code": appErr.Code, "message": appErr.Message}})
		return
	}
	log.Printf("unexpected error on %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "internal_error", "message": "Күтпеген қате орын алды, қайталап көріңіз"}})
}
