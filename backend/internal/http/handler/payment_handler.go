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
		response.Error(c, apperror.BadRequest("invalid contract id"))
		return
	}
	if !h.canAccessContract(c, contractID) {
		response.Error(c, apperror.Forbidden("you cannot view this contract's payment"))
		return
	}
	payment, err := h.payments.GetByContractID(c.Request.Context(), contractID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, paymentDTO(payment))
}

type submitPaymentRequest struct {
	ReceiptFileURL string `json:"receipt_file_url" binding:"required"`
}

// Submit is student-only; ownership is checked inside the service.
func (h *PaymentHandler) Submit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid payment id"))
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
		response.Error(c, apperror.BadRequest("invalid payment id"))
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
