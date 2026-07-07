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

type ExitRequestHandler struct {
	exitRequests *service.ExitRequestService
}

func NewExitRequestHandler(exitRequests *service.ExitRequestService) *ExitRequestHandler {
	return &ExitRequestHandler{exitRequests: exitRequests}
}

type createExitRequestRequest struct {
	Reason *string `json:"reason"`
}

// Create is student-only: it resolves the caller's own active room stay.
func (h *ExitRequestHandler) Create(c *gin.Context) {
	var req createExitRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	er, err := h.exitRequests.Create(c.Request.Context(), studentID, req.Reason)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, exitRequestDTO(er))
}

func (h *ExitRequestHandler) ListMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	list, err := h.exitRequests.ListMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, exitRequestsDTO(list))
}

// Get is available to the owning student or admin/manager.
func (h *ExitRequestHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid exit request id"))
		return
	}
	er, err := h.exitRequests.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	role, _ := middleware.Role(c)
	userID, _ := middleware.UserID(c)
	if role != domain.RoleAdmin && role != domain.RoleManager && er.StudentID != userID {
		response.Error(c, apperror.Forbidden("you cannot view this exit request"))
		return
	}
	response.OK(c, exitRequestDTO(er))
}

// List is manager/admin-only: optionally filtered by ?status=.
func (h *ExitRequestHandler) List(c *gin.Context) {
	var status *domain.ExitRequestStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.ExitRequestStatus(raw)
		switch s {
		case domain.ExitRequestPending, domain.ExitRequestApproved, domain.ExitRequestRejected:
			status = &s
		default:
			response.Error(c, apperror.BadRequest("invalid status filter"))
			return
		}
	}
	list, err := h.exitRequests.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, exitRequestsDTO(list))
}

type decideExitRequestRequest struct {
	Action  string  `json:"action" binding:"required"`
	Comment *string `json:"comment"`
}

// Decide is manager/admin-only.
func (h *ExitRequestHandler) Decide(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid exit request id"))
		return
	}
	var req decideExitRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	er, err := h.exitRequests.Decide(c.Request.Context(), actorID, id, req.Action, req.Comment)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, exitRequestDTO(er))
}
