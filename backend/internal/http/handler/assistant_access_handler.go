package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

// AssistantAccessHandler is admin-only: which roles may use the AI
// assistant. Model, limits and the API key are fixed in code/environment
// and never editable here.
type AssistantAccessHandler struct {
	access *service.AssistantAccessService
}

func NewAssistantAccessHandler(access *service.AssistantAccessService) *AssistantAccessHandler {
	return &AssistantAccessHandler{access: access}
}

type assistantAccessResponse struct {
	// APIKeyConfigured: the server has an AI API key; without one the
	// assistant is off for everyone whatever is allowed here.
	APIKeyConfigured bool                       `json:"api_key_configured"`
	Model            string                     `json:"model"`
	Audiences        []domain.AssistantAudience `json:"audiences"`
	AllAudiences     []domain.AssistantAudience `json:"all_audiences"`
	UpdatedBy        *uuid.UUID                 `json:"updated_by"`
	UpdatedAt        *time.Time                 `json:"updated_at"`
}

func (h *AssistantAccessHandler) respond(c *gin.Context, a domain.AssistantAccess) {
	response.OK(c, assistantAccessResponse{
		APIKeyConfigured: h.access.APIKeyPresent(),
		Model:            service.AIModelName,
		Audiences:        a.Audiences,
		AllAudiences:     domain.AssistantAudiences,
		UpdatedBy:        a.UpdatedBy,
		UpdatedAt:        a.UpdatedAt,
	})
}

func (h *AssistantAccessHandler) Get(c *gin.Context) {
	h.respond(c, h.access.Current())
}

type updateAssistantAccessRequest struct {
	Audiences []domain.AssistantAudience `json:"audiences"`
}

// Update applies immediately, no restart.
func (h *AssistantAccessHandler) Update(c *gin.Context) {
	var req updateAssistantAccessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	saved, err := h.access.Update(c.Request.Context(), actorID, req.Audiences)
	if err != nil {
		response.Error(c, err)
		return
	}
	h.respond(c, saved)
}
