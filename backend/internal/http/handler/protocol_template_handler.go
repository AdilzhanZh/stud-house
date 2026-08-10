package handler

import (
	"time"

	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type ProtocolTemplateHandler struct {
	templates *service.ProtocolTemplateService
}

func NewProtocolTemplateHandler(templates *service.ProtocolTemplateService) *ProtocolTemplateHandler {
	return &ProtocolTemplateHandler{templates: templates}
}

type protocolVariableResponse struct {
	Token string `json:"token"`
	Label string `json:"label"`
}

type protocolTemplateResponse struct {
	Pages     []string                   `json:"pages"`
	UpdatedAt *time.Time                 `json:"updated_at"`
	Variables []protocolVariableResponse `json:"variables,omitempty"`
}

// Get is manager/admin-only: loads the single system-wide template plus the
// fixed variable whitelist the editor UI lets a manager insert.
func (h *ProtocolTemplateHandler) Get(c *gin.Context) {
	t, err := h.templates.Get(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	vars := make([]protocolVariableResponse, 0, len(domain.ProtocolVariables))
	for _, v := range domain.ProtocolVariables {
		vars = append(vars, protocolVariableResponse{Token: v.Token, Label: v.Label})
	}
	var updatedAt *time.Time
	if !t.UpdatedAt.IsZero() {
		u := t.UpdatedAt
		updatedAt = &u
	}
	response.OK(c, protocolTemplateResponse{Pages: t.Pages, UpdatedAt: updatedAt, Variables: vars})
}

type updateProtocolTemplateRequest struct {
	Pages []string `json:"pages" binding:"required"`
}

// Update is manager/admin-only: overwrites the single system-wide template.
func (h *ProtocolTemplateHandler) Update(c *gin.Context) {
	var req updateProtocolTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	t, err := h.templates.Update(c.Request.Context(), actorID, req.Pages)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, protocolTemplateResponse{Pages: t.Pages, UpdatedAt: &t.UpdatedAt})
}
