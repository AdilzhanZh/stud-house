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

type ContractTemplateHandler struct {
	templates *service.ContractTemplateService
}

func NewContractTemplateHandler(templates *service.ContractTemplateService) *ContractTemplateHandler {
	return &ContractTemplateHandler{templates: templates}
}

type contractVariableResponse struct {
	Token string `json:"token"`
	Label string `json:"label"`
}

type contractTemplateResponse struct {
	Language  string                     `json:"language"`
	Pages     []string                   `json:"pages"`
	UpdatedAt *time.Time                 `json:"updated_at"`
	Variables []contractVariableResponse `json:"variables,omitempty"`
}

// requestedLanguage reads ?language=kk|ru, defaulting to kk so an old client
// (or a bare GET during manual testing) still gets a sensible template
// instead of a 400.
func requestedLanguage(c *gin.Context) domain.ContractLanguage {
	lang := domain.ContractLanguage(c.Query("language"))
	if lang == "" {
		return domain.ContractLanguageKK
	}
	return lang
}

// Get is any-authenticated-user: loads the requested language's template
// plus the fixed variable whitelist the editor UI lets a manager insert. A
// student needs this client-side to render/download their own contract in
// whichever language they choose (see frontend's contractPdf.ts) — only
// Update is admin/manager-only.
func (h *ContractTemplateHandler) Get(c *gin.Context) {
	language := requestedLanguage(c)
	t, err := h.templates.Get(c.Request.Context(), language)
	if err != nil {
		response.Error(c, err)
		return
	}
	vars := make([]contractVariableResponse, 0, len(domain.ContractVariables))
	for _, v := range domain.ContractVariables {
		vars = append(vars, contractVariableResponse{Token: v.Token, Label: v.Label})
	}
	var updatedAt *time.Time
	if !t.UpdatedAt.IsZero() {
		u := t.UpdatedAt
		updatedAt = &u
	}
	response.OK(c, contractTemplateResponse{Language: string(t.Language), Pages: t.Pages, UpdatedAt: updatedAt, Variables: vars})
}

type updateContractTemplateRequest struct {
	Pages []string `json:"pages" binding:"required"`
}

// Update is manager/admin-only: overwrites the given language's template
// (?language=kk|ru, required — no default, unlike Get).
func (h *ContractTemplateHandler) Update(c *gin.Context) {
	var req updateContractTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	language := domain.ContractLanguage(c.Query("language"))
	actorID, _ := middleware.UserID(c)
	t, err := h.templates.Update(c.Request.Context(), actorID, language, req.Pages)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, contractTemplateResponse{Language: string(t.Language), Pages: t.Pages, UpdatedAt: &t.UpdatedAt})
}
