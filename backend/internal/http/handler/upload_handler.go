package handler

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type UploadHandler struct {
	uploadDir string
}

func NewUploadHandler(uploadDir string) *UploadHandler {
	return &UploadHandler{uploadDir: uploadDir}
}

type uploadResponse struct {
	URL string `json:"url"`
}

// Upload is available to any authenticated user: accepts a multipart "file"
// field and stores it under uploadDir with a random name (original
// extension kept), so files can be picked from the caller's own computer
// instead of pasting an external URL into a text field (dormitory images,
// application/payment documents, etc). The returned URL
// is absolute (built from the incoming request's own host/scheme) and is
// served back by the static /api/v1/uploads/ route registered in router.go.
func (h *UploadHandler) Upload(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, apperror.BadRequest("файл міндетті"))
		return
	}

	if err := os.MkdirAll(h.uploadDir, 0o755); err != nil {
		response.Error(c, err)
		return
	}

	name := uuid.NewString() + filepath.Ext(file.Filename)
	if err := c.SaveUploadedFile(file, filepath.Join(h.uploadDir, name)); err != nil {
		response.Error(c, err)
		return
	}

	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if fwd := c.GetHeader("X-Forwarded-Proto"); fwd != "" {
		scheme = fwd
	}
	url := fmt.Sprintf("%s://%s/api/v1/uploads/%s", scheme, c.Request.Host, name)
	response.Created(c, uploadResponse{URL: url})
}
