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

type ApplicationHandler struct {
	applications *service.ApplicationService
}

func NewApplicationHandler(applications *service.ApplicationService) *ApplicationHandler {
	return &ApplicationHandler{applications: applications}
}

type createApplicationRequest struct {
	DormitoryID       uuid.UUID `json:"dormitory_id" binding:"required"`
	PreferredRoomType *string   `json:"preferred_room_type"`
	Notes             *string   `json:"notes"`
}

// Create is student-only: it always creates the application for the caller.
func (h *ApplicationHandler) Create(c *gin.Context) {
	var req createApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	app, err := h.applications.Create(c.Request.Context(), studentID, req.DormitoryID, req.PreferredRoomType, req.Notes)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, applicationDTO(app))
}

func (h *ApplicationHandler) ListMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	list, err := h.applications.ListMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationsDTO(list))
}

type resubmitApplicationRequest struct {
	PreferredRoomType *string `json:"preferred_room_type"`
	Notes             *string `json:"notes"`
}

// Resubmit is student-only: editing is only allowed on the caller's own
// application while it is in needs_correction, and moves it back to pending.
func (h *ApplicationHandler) Resubmit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid application id"))
		return
	}
	var req resubmitApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	app, err := h.applications.Resubmit(c.Request.Context(), studentID, id, req.PreferredRoomType, req.Notes)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationDTO(app))
}

type addApplicationDocumentRequest struct {
	BenefitRequiredDocumentID *uuid.UUID `json:"benefit_required_document_id"`
	DocumentName              *string    `json:"document_name"`
	FileURL                   string     `json:"file_url" binding:"required"`
}

// AddDocument is student-only: the frontend is assumed to have already
// uploaded the file (e.g. via a presigned URL or local disk endpoint) and
// only passes back the resulting file_url here.
func (h *ApplicationHandler) AddDocument(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid application id"))
		return
	}
	var req addApplicationDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	doc, err := h.applications.AddDocument(c.Request.Context(), studentID, id, req.BenefitRequiredDocumentID, req.DocumentName, req.FileURL)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, applicationDocumentDTO(doc))
}

// List is manager/admin-only: the queue view, optionally filtered by status.
func (h *ApplicationHandler) List(c *gin.Context) {
	var status *domain.ApplicationStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.ApplicationStatus(raw)
		if !s.Valid() {
			response.Error(c, apperror.BadRequest("invalid status filter"))
			return
		}
		status = &s
	}
	list, err := h.applications.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationsDTO(list))
}

// GetDetail is manager/admin-only: full application + documents + history.
func (h *ApplicationHandler) GetDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid application id"))
		return
	}
	app, err := h.applications.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	documents, err := h.applications.ListDocuments(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	history, err := h.applications.ListHistory(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationDetailResponse{
		applicationResponse: applicationDTO(app),
		Documents:           applicationDocumentsDTO(documents),
		History:             applicationStatusHistoriesDTO(history),
	})
}

type decisionRequest struct {
	Action  service.DecisionAction `json:"action" binding:"required"`
	RoomID  *uuid.UUID             `json:"room_id"`
	Comment *string                `json:"comment"`
}

// Decide is manager/admin-only: approve / reject / request_correction.
func (h *ApplicationHandler) Decide(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid application id"))
		return
	}
	var req decisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	app, err := h.applications.Decide(c.Request.Context(), actorID, id, req.Action, req.RoomID, req.Comment)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationDTO(app))
}
