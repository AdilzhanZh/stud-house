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

type ReferralTemplateHandler struct {
	templates *service.ReferralTemplateService
}

func NewReferralTemplateHandler(templates *service.ReferralTemplateService) *ReferralTemplateHandler {
	return &ReferralTemplateHandler{templates: templates}
}

type referralVariableResponse struct {
	Token string `json:"token"`
	Label string `json:"label"`
}

type referralTemplateResponse struct {
	Pages     []string                   `json:"pages"`
	UpdatedAt *time.Time                 `json:"updated_at"`
	Variables []referralVariableResponse `json:"variables,omitempty"`
}

// Get loads the template for the editor. Referrals themselves carry their pages
// (see referralDTO), so this stays manager/admin-only.
func (h *ReferralTemplateHandler) Get(c *gin.Context) {
	t, err := h.templates.Get(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	vars := make([]referralVariableResponse, 0, len(domain.ReferralVariables))
	for _, v := range domain.ReferralVariables {
		vars = append(vars, referralVariableResponse{Token: v.Token, Label: v.Label})
	}
	var updatedAt *time.Time
	if !t.UpdatedAt.IsZero() {
		updatedAt = &t.UpdatedAt
	}
	response.OK(c, referralTemplateResponse{Pages: t.Pages, UpdatedAt: updatedAt, Variables: vars})
}

type updateReferralTemplateRequest struct {
	Pages []string `json:"pages" binding:"required"`
}

func (h *ReferralTemplateHandler) Update(c *gin.Context) {
	var req updateReferralTemplateRequest
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
	response.OK(c, referralTemplateResponse{Pages: t.Pages, UpdatedAt: &t.UpdatedAt})
}
