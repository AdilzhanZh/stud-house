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

type PetitionTemplateHandler struct {
	templates *service.PetitionTemplateService
}

func NewPetitionTemplateHandler(templates *service.PetitionTemplateService) *PetitionTemplateHandler {
	return &PetitionTemplateHandler{templates: templates}
}

type petitionVariableResponse struct {
	Token string `json:"token"`
	Label string `json:"label"`
}

type petitionTemplateResponse struct {
	Pages     []string                   `json:"pages"`
	UpdatedAt *time.Time                 `json:"updated_at"`
	Variables []petitionVariableResponse `json:"variables,omitempty"`
}

// Get is manager/admin-only: loads the single system-wide template plus the
// fixed variable whitelist the editor UI lets a manager insert.
func (h *PetitionTemplateHandler) Get(c *gin.Context) {
	t, err := h.templates.Get(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	vars := make([]petitionVariableResponse, 0, len(domain.PetitionVariables))
	for _, v := range domain.PetitionVariables {
		vars = append(vars, petitionVariableResponse{Token: v.Token, Label: v.Label})
	}
	var updatedAt *time.Time
	if !t.UpdatedAt.IsZero() {
		u := t.UpdatedAt
		updatedAt = &u
	}
	response.OK(c, petitionTemplateResponse{Pages: t.Pages, UpdatedAt: updatedAt, Variables: vars})
}

type updatePetitionTemplateRequest struct {
	Pages []string `json:"pages" binding:"required"`
}

// Update is manager/admin-only: overwrites the single system-wide template.
func (h *PetitionTemplateHandler) Update(c *gin.Context) {
	var req updatePetitionTemplateRequest
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
	response.OK(c, petitionTemplateResponse{Pages: t.Pages, UpdatedAt: &t.UpdatedAt})
}
