package handler

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/reqlang"
	"student-house/pkg/response"
)

type TriageHandler struct {
	triage *service.TriageService
}

func NewTriageHandler(triage *service.TriageService) *TriageHandler {
	return &TriageHandler{triage: triage}
}

type triageReasonResponse struct {
	Code           string `json:"code"`
	DocumentNameKk string `json:"document_name_kk,omitempty"`
	DocumentNameRu string `json:"document_name_ru,omitempty"`
	Detail         string `json:"detail,omitempty"`
}

type applicationTriageResponse struct {
	ApplicationID uuid.UUID              `json:"application_id"`
	Color         string                 `json:"color"`
	Reasons       []triageReasonResponse `json:"reasons"`
	Checking      bool                   `json:"checking"`
}

// List is manager/admin-only: the green/yellow/red sorting of every pending
// application.
func (h *TriageHandler) List(c *gin.Context) {
	list, err := h.triage.ListPending(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	lang := reqlang.Get(c)
	out := make([]applicationTriageResponse, 0, len(list))
	for _, t := range list {
		reasons := make([]triageReasonResponse, 0, len(t.Reasons))
		for _, r := range t.Reasons {
			detail := apperror.Translate(r.Detail, lang)
			if lang != "kk" && r.DetailRu != "" {
				detail = r.DetailRu
			}
			reasons = append(reasons, triageReasonResponse{
				Code:           string(r.Code),
				DocumentNameKk: r.DocumentNameKk,
				DocumentNameRu: r.DocumentNameRu,
				Detail:         detail,
			})
		}
		out = append(out, applicationTriageResponse{ApplicationID: t.ApplicationID, Color: string(t.Color), Reasons: reasons, Checking: t.Checking})
	}
	response.OK(c, out)
}

type bulkTriageRequest struct {
	ApplicationIDs []uuid.UUID `json:"application_ids" binding:"required"`
}

type bulkResultResponse struct {
	ApplicationID uuid.UUID `json:"application_id"`
	OK            bool      `json:"ok"`
	Error         string    `json:"error,omitempty"`
}

// ApproveGreen is manager/admin-only: approves every given application that
// is still green.
func (h *TriageHandler) ApproveGreen(c *gin.Context) {
	h.bulk(c, h.triage.ApproveGreen)
}

// RequestCorrections is manager/admin-only: sends every given application
// that is still yellow back to its student with the list of what to fix.
func (h *TriageHandler) RequestCorrections(c *gin.Context) {
	h.bulk(c, h.triage.RequestCorrections)
}

func (h *TriageHandler) bulk(c *gin.Context, run func(ctx context.Context, actorID uuid.UUID, ids []uuid.UUID) ([]service.BulkResult, error)) {
	var req bulkTriageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	results, err := run(c.Request.Context(), actorID, req.ApplicationIDs)
	if err != nil {
		response.Error(c, err)
		return
	}
	lang := reqlang.Get(c)
	out := make([]bulkResultResponse, 0, len(results))
	for _, r := range results {
		out = append(out, bulkResultResponse{
			ApplicationID: r.ApplicationID,
			OK:            r.Error == "",
			Error:         apperror.Translate(r.Error, lang),
		})
	}
	response.OK(c, out)
}
