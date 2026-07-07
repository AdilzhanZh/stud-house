package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type ReportHandler struct {
	reports *service.ReportService
}

func NewReportHandler(reports *service.ReportService) *ReportHandler {
	return &ReportHandler{reports: reports}
}

type createReportTemplateRequest struct {
	Name    string `json:"name" binding:"required"`
	FileURL string `json:"file_url" binding:"required"`
}

// CreateTemplate is manager/admin-only.
func (h *ReportHandler) CreateTemplate(c *gin.Context) {
	var req createReportTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	t, err := h.reports.CreateTemplate(c.Request.Context(), actorID, req.Name, req.FileURL)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, reportTemplateDTO(t))
}

func (h *ReportHandler) ListTemplates(c *gin.Context) {
	list, err := h.reports.ListTemplates(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, reportTemplatesDTO(list))
}

type createReportRequest struct {
	TemplateID     uuid.UUID   `json:"template_id" binding:"required"`
	ApplicationIDs []uuid.UUID `json:"application_ids" binding:"required"`
}

// Create is manager/admin-only.
func (h *ReportHandler) Create(c *gin.Context) {
	var req createReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	report, err := h.reports.CreateReport(c.Request.Context(), actorID, req.TemplateID, req.ApplicationIDs)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, reportDTO(report))
}

// List is manager/admin-only: optionally filtered by ?status=.
func (h *ReportHandler) List(c *gin.Context) {
	var status *domain.ReportStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.ReportStatus(raw)
		if !s.Valid() {
			response.Error(c, apperror.BadRequest("invalid status filter"))
			return
		}
		status = &s
	}
	list, err := h.reports.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, reportsDTO(list))
}

// GetDetail is available to any authenticated user (read-only unless they
// are a committee_member, who can additionally vote via PATCH .../vote).
func (h *ReportHandler) GetDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid report id"))
		return
	}
	detail, err := h.reports.GetDetail(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, reportDetailDTO(detail))
}

// Export returns the same report detail shape (template file_url + student
// list) intended for the manager to feed into document generation, which
// remains out of scope this phase.
func (h *ReportHandler) Export(c *gin.Context) {
	h.GetDetail(c)
}

type voteReportRequest struct {
	Decision domain.VoteDecision `json:"decision" binding:"required"`
	Reason   *string             `json:"reason"`
}

// Vote is committee_member-only (a chairperson qualifies automatically,
// since it's a flag on top of that role, not a separate one).
func (h *ReportHandler) Vote(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid report id"))
		return
	}
	var req voteReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	report, err := h.reports.Vote(c.Request.Context(), actorID, id, req.Decision, req.Reason)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, reportDTO(report))
}

type reviseReportRequest struct {
	ApplicationIDs []uuid.UUID `json:"application_ids" binding:"required"`
}

// Revise is manager/admin-only, and only on a rejected report.
func (h *ReportHandler) Revise(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid report id"))
		return
	}
	var req reviseReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	report, err := h.reports.Revise(c.Request.Context(), actorID, id, req.ApplicationIDs)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, reportDTO(report))
}
