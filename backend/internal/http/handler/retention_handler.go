package handler

import (
	"github.com/gin-gonic/gin"

	"student-house/internal/service"
	"student-house/pkg/response"
)

type RetentionHandler struct {
	retention *service.RetentionService
}

func NewRetentionHandler(retention *service.RetentionService) *RetentionHandler {
	return &RetentionHandler{retention: retention}
}

// Purge is admin-only: manually runs the same one-year data-retention sweep
// the background ticker performs, for cron-less environments and manual
// verification.
func (h *RetentionHandler) Purge(c *gin.Context) {
	result, err := h.retention.PurgeExpired(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{
		"protocols_deleted":    result.ProtocolsDeleted,
		"contracts_deleted":    result.ContractsDeleted,
		"applications_deleted": result.ApplicationsDeleted,
	})
}
