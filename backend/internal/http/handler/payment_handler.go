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

type PaymentHandler struct {
	payments     *service.PaymentService
	contracts    *service.ContractService
	applications *service.ApplicationService
}

func NewPaymentHandler(payments *service.PaymentService, contracts *service.ContractService, applications *service.ApplicationService) *PaymentHandler {
	return &PaymentHandler{payments: payments, contracts: contracts, applications: applications}
}

// canAccessContract allows admin/manager unconditionally, and a student only
// for the contract tied to their own application.
func (h *PaymentHandler) canAccessContract(c *gin.Context, contractID uuid.UUID) bool {
	role, _ := middleware.Role(c)
	if role == domain.RoleAdmin || role == domain.RoleManager {
		return true
	}
	contract, err := h.contracts.GetByID(c.Request.Context(), contractID)
	if err != nil {
		return false
	}
	app, err := h.applications.GetByID(c.Request.Context(), contract.ApplicationID)
	if err != nil {
		return false
	}
	userID, ok := middleware.UserID(c)
	return ok && app.StudentID == userID
}

// GetByContract is available to the owning student or admin/manager.
func (h *PaymentHandler) GetByContract(c *gin.Context) {
	contractID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("келісімшарт идентификаторы дұрыс емес"))
		return
	}
	if !h.canAccessContract(c, contractID) {
		response.Error(c, apperror.Forbidden("бұл келісімшарттың төлемін көруге құқығыңыз жоқ"))
		return
	}
	payment, err := h.payments.GetByContractID(c.Request.Context(), contractID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, paymentDTO(payment))
}

// ListMine is student-only: every payment tied to one of the caller's own
// contracts.
func (h *PaymentHandler) ListMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	list, err := h.payments.ListMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]paymentResponse, 0, len(list))
	for _, p := range list {
		out = append(out, paymentDTO(p))
	}
	response.OK(c, out)
}

// List is manager/admin-only: optionally filtered by ?status=.
func (h *PaymentHandler) List(c *gin.Context) {
	var status *domain.PaymentStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.PaymentStatus(raw)
		switch s {
		case domain.PaymentPending, domain.PaymentSubmitted, domain.PaymentAwaitingManagerDecision, domain.PaymentConfirmed, domain.PaymentRejected:
			status = &s
		default:
			response.Error(c, apperror.BadRequest("статус фильтрі дұрыс емес"))
			return
		}
	}
	list, err := h.payments.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	out := make([]paymentResponse, 0, len(list))
	for _, p := range list {
		out = append(out, paymentDTO(p))
	}
	response.OK(c, out)
}

type submitPaymentRequest struct {
	ReceiptFileURL string `json:"receipt_file_url" binding:"required"`
}

// Submit is student-only; ownership is checked inside the service.
func (h *PaymentHandler) Submit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("төлем идентификаторы дұрыс емес"))
		return
	}
	var req submitPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	payment, err := h.payments.Submit(c.Request.Context(), actorID, id, req.ReceiptFileURL)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, paymentDTO(payment))
}

type confirmPaymentRequest struct {
	Action string `json:"action" binding:"required"`
}

// Confirm is manager/admin-only.
func (h *PaymentHandler) Confirm(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("төлем идентификаторы дұрыс емес"))
		return
	}
	var req confirmPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	payment, err := h.payments.Confirm(c.Request.Context(), actorID, id, req.Action)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, paymentDTO(payment))
}

// ExpireCheck is admin/manager-only: manually runs the same overdue-flagging
// and deadline-reminder sweep the background ticker performs, for
// cron-less environments. Flagging never rejects an application by itself —
// see ManagerDecision.
func (h *PaymentHandler) ExpireCheck(c *gin.Context) {
	flagged, err := h.payments.FlagOverduePayments(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	reminded, err := h.payments.RemindApproachingPaymentDeadline(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"flagged_count": flagged, "reminded_count": reminded})
}

type paymentManagerDecisionRequest struct {
	Action      string     `json:"action" binding:"required"`
	NewDeadline *time.Time `json:"new_deadline"`
}

// ManagerDecision is admin/manager-only: resolves a payment that's
// awaiting_manager_decision (deadline already passed) — void rejects the
// application, frees the room, and blocks the student from reapplying;
// extend gives a new deadline.
func (h *PaymentHandler) ManagerDecision(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("төлем идентификаторы дұрыс емес"))
		return
	}
	var req paymentManagerDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	payment, err := h.payments.ManagerDecision(c.Request.Context(), actorID, id, req.Action, req.NewDeadline)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, paymentDTO(payment))
}
