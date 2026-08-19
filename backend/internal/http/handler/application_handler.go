package handler

import (
	"net/http"

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
	DormitoryID       uuid.UUID  `json:"dormitory_id" binding:"required"`
	PreferredRoomType *string    `json:"preferred_room_type"`
	PreferredRoomID   *uuid.UUID `json:"preferred_room_id"`
	Notes             *string    `json:"notes"`
	StudyGroup        string     `json:"study_group" binding:"required"`
	Hometown          string     `json:"hometown" binding:"required"`
	ParentContact     string     `json:"parent_contact" binding:"required"`
}

// Create is student-only: it always creates the application for the caller.
func (h *ApplicationHandler) Create(c *gin.Context) {
	var req createApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	app, err := h.applications.Create(c.Request.Context(), studentID, req.DormitoryID, req.PreferredRoomType, req.Notes, req.PreferredRoomID, req.StudyGroup, req.Hometown, req.ParentContact)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, applicationDTO(app))
}

// Delete is student-only: lets the caller delete their own still-pending or
// rejected application (see ApplicationService.CancelOwn).
func (h *ApplicationHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
		return
	}
	studentID, _ := middleware.UserID(c)
	if err := h.applications.CancelOwn(c.Request.Context(), studentID, id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
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
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
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
	BenefitRequiredDocumentID   *uuid.UUID `json:"benefit_required_document_id"`
	DormitoryRequiredDocumentID *uuid.UUID `json:"dormitory_required_document_id"`
	DocumentName                *string    `json:"document_name"`
	FileURL                     string     `json:"file_url" binding:"required"`
}

// AddDocument is student-only: the frontend is assumed to have already
// uploaded the file (e.g. via a presigned URL or local disk endpoint) and
// only passes back the resulting file_url here.
func (h *ApplicationHandler) AddDocument(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
		return
	}
	var req addApplicationDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	doc, err := h.applications.AddDocument(c.Request.Context(), studentID, id, req.BenefitRequiredDocumentID, req.DormitoryRequiredDocumentID, req.DocumentName, req.FileURL)
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
			response.Error(c, apperror.BadRequest("статус фильтрі дұрыс емес"))
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

// canAccessApplication allows admin/manager unconditionally, and a student
// only for their own application (mirrors ContractHandler's helper of the
// same name for the same ownership rule).
func canAccessApplication(c *gin.Context, app *domain.Application) bool {
	role, _ := middleware.Role(c)
	if role == domain.RoleAdmin || role == domain.RoleManager {
		return true
	}
	userID, ok := middleware.UserID(c)
	return ok && app.StudentID == userID
}

// GetDetail is available to the owning student or admin/manager: full
// application + documents + history (a student views their own application's
// status timeline and uploaded documents; a manager reviews any of them).
func (h *ApplicationHandler) GetDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
		return
	}
	app, err := h.applications.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	if !canAccessApplication(c, app) {
		response.Error(c, apperror.Forbidden("бұл өтінішті көруге құқығыңыз жоқ"))
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
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
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

type cancelApprovedRequest struct {
	Comment string `json:"comment" binding:"required"`
}

// CancelApproved is admin/manager-only: cancels an application stuck in
// 'approved' status (e.g. no committee members configured, so it can never
// reach a protocol/contract). Decide only accepts 'pending' applications, so
// this is a separate endpoint for the one non-pending status that can still
// legitimately need to be undone.
func (h *ApplicationHandler) CancelApproved(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
		return
	}
	var req cancelApprovedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	app, err := h.applications.CancelApproved(c.Request.Context(), actorID, id, req.Comment)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationDTO(app))
}
