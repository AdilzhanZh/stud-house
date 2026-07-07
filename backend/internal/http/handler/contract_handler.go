package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type ContractHandler struct {
	contracts    *service.ContractService
	applications *service.ApplicationService
}

func NewContractHandler(contracts *service.ContractService, applications *service.ApplicationService) *ContractHandler {
	return &ContractHandler{contracts: contracts, applications: applications}
}

// canAccessApplication allows admin/manager unconditionally, and a student
// only for their own application.
func (h *ContractHandler) canAccessApplication(c *gin.Context, applicationID uuid.UUID) bool {
	role, _ := middleware.Role(c)
	if role == domain.RoleAdmin || role == domain.RoleManager {
		return true
	}
	app, err := h.applications.GetByID(c.Request.Context(), applicationID)
	if err != nil {
		return false
	}
	userID, ok := middleware.UserID(c)
	return ok && app.StudentID == userID
}

// ListMine is student-only: every contract tied to one of the caller's own
// applications.
func (h *ContractHandler) ListMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	list, err := h.contracts.ListMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]contractResponse, 0, len(list))
	for _, ct := range list {
		out = append(out, contractDTO(ct))
	}
	response.OK(c, out)
}

// GetByApplication is available to the owning student or admin/manager.
func (h *ContractHandler) GetByApplication(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid application id"))
		return
	}
	if !h.canAccessApplication(c, appID) {
		response.Error(c, apperror.Forbidden("you cannot view this application's contract"))
		return
	}
	contract, err := h.contracts.GetByApplicationID(c.Request.Context(), appID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, contractDTO(contract))
}

type respondContractRequest struct {
	Action string `json:"action" binding:"required"`
}

// Respond is student-only; ownership of the underlying application is
// checked inside the service.
func (h *ContractHandler) Respond(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid contract id"))
		return
	}
	var req respondContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	contract, err := h.contracts.Respond(c.Request.Context(), actorID, id, req.Action)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, contractDTO(contract))
}

// ExpireCheck is admin/manager-only: manually runs the same overdue-flagging
// and deadline-reminder sweep the background ticker performs, for
// cron-less environments. Flagging never expires anything by itself — see
// ManagerDecision.
func (h *ContractHandler) ExpireCheck(c *gin.Context) {
	flagged, err := h.contracts.FlagOverdueContracts(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	reminded, err := h.contracts.RemindApproachingDeadline(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"flagged_count": flagged, "reminded_count": reminded})
}

// List is admin/manager-only: optionally filtered by ?status=, e.g.
// awaiting_manager_decision for the manager's queue.
func (h *ContractHandler) List(c *gin.Context) {
	var status *domain.ContractStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.ContractStatus(raw)
		switch s {
		case domain.ContractSent, domain.ContractAwaitingManagerDecision, domain.ContractAccepted, domain.ContractDeclined, domain.ContractExpired:
			status = &s
		default:
			response.Error(c, apperror.BadRequest("invalid status filter"))
			return
		}
	}
	list, err := h.contracts.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]contractResponse, 0, len(list))
	for _, ct := range list {
		out = append(out, contractDTO(ct))
	}
	response.OK(c, out)
}

type contractManagerDecisionRequest struct {
	Action      string     `json:"action" binding:"required"`
	NewDeadline *time.Time `json:"new_deadline"`
}

// ManagerDecision is admin/manager-only: resolves a contract that's
// awaiting_manager_decision (deadline already passed) — void rejects the
// application and frees the room, extend gives a new deadline.
func (h *ContractHandler) ManagerDecision(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid contract id"))
		return
	}
	var req contractManagerDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	contract, err := h.contracts.ManagerDecision(c.Request.Context(), actorID, id, req.Action, req.NewDeadline)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, contractDTO(contract))
}
