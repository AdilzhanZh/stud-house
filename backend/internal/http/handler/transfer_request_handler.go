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

type TransferRequestHandler struct {
	transferRequests *service.TransferRequestService
}

func NewTransferRequestHandler(transferRequests *service.TransferRequestService) *TransferRequestHandler {
	return &TransferRequestHandler{transferRequests: transferRequests}
}

type createTransferRequestRequest struct {
	RequestedDormitoryID *uuid.UUID `json:"requested_dormitory_id"`
	RequestedRoomID      *uuid.UUID `json:"requested_room_id"`
	Reason               *string    `json:"reason"`
}

// Create is student-only: it resolves the caller's own active room stay.
func (h *TransferRequestHandler) Create(c *gin.Context) {
	var req createTransferRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	studentID, _ := middleware.UserID(c)
	tr, err := h.transferRequests.Create(c.Request.Context(), studentID, req.RequestedDormitoryID, req.RequestedRoomID, req.Reason)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, transferRequestDTO(tr))
}

func (h *TransferRequestHandler) ListMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	list, err := h.transferRequests.ListMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, transferRequestsDTO(list))
}

// Get is available to the owning student or admin/manager.
func (h *TransferRequestHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("ауыстыру сұранысының идентификаторы дұрыс емес"))
		return
	}
	tr, err := h.transferRequests.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	role, _ := middleware.Role(c)
	userID, _ := middleware.UserID(c)
	if role != domain.RoleAdmin && role != domain.RoleManager && tr.StudentID != userID {
		response.Error(c, apperror.Forbidden("бұл ауыстыру сұранысын көруге құқығыңыз жоқ"))
		return
	}
	response.OK(c, transferRequestDTO(tr))
}

// List is manager/admin-only: optionally filtered by ?status=.
func (h *TransferRequestHandler) List(c *gin.Context) {
	var status *domain.TransferRequestStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.TransferRequestStatus(raw)
		switch s {
		case domain.TransferRequestPending, domain.TransferRequestApproved, domain.TransferRequestRejected:
			status = &s
		default:
			response.Error(c, apperror.BadRequest("статус фильтрі дұрыс емес"))
			return
		}
	}
	list, err := h.transferRequests.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, transferRequestsDTO(list))
}

type decideTransferRequestRequest struct {
	Action  string     `json:"action" binding:"required"`
	RoomID  *uuid.UUID `json:"room_id"`
	Comment *string    `json:"comment"`
}

// Decide is manager/admin-only.
func (h *TransferRequestHandler) Decide(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("ауыстыру сұранысының идентификаторы дұрыс емес"))
		return
	}
	var req decideTransferRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	tr, err := h.transferRequests.Decide(c.Request.Context(), actorID, id, req.Action, req.RoomID, req.Comment)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, transferRequestDTO(tr))
}
