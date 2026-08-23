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

type ProtocolHandler struct {
	protocols    *service.ProtocolService
	applications *service.ApplicationService
}

func NewProtocolHandler(protocols *service.ProtocolService, applications *service.ApplicationService) *ProtocolHandler {
	return &ProtocolHandler{protocols: protocols, applications: applications}
}

// canAccessApplication allows admin/manager unconditionally, and a student
// only for their own application — mirrors ContractHandler's method of the
// same name exactly.
func (h *ProtocolHandler) canAccessApplication(c *gin.Context, applicationID uuid.UUID) bool {
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

// GetByApplication is available to the owning student or admin/manager —
// used by the application journey stepper to tell whether an approved
// application is still waiting to be sent to committee, is under
// committee review, or has been unanimously approved.
func (h *ProtocolHandler) GetByApplication(c *gin.Context) {
	appID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("өтініш идентификаторы дұрыс емес"))
		return
	}
	if !h.canAccessApplication(c, appID) {
		response.Error(c, apperror.Forbidden("бұл өтініштің хаттамасын көруге құқығыңыз жоқ"))
		return
	}
	protocol, err := h.protocols.GetByApplicationID(c.Request.Context(), appID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, protocolDTO(protocol))
}

type createProtocolRequest struct {
	ApplicationIDs []uuid.UUID `json:"application_ids" binding:"required"`
}

// Create ("Хаттама дайындау") is manager/admin-only.
func (h *ProtocolHandler) Create(c *gin.Context) {
	var req createProtocolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	protocol, err := h.protocols.Create(c.Request.Context(), actorID, req.ApplicationIDs)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, protocolDTO(protocol))
}

// List is manager/admin-only: optionally filtered by ?status=.
func (h *ProtocolHandler) List(c *gin.Context) {
	var status *domain.ProtocolStatus
	if raw := c.Query("status"); raw != "" {
		s := domain.ProtocolStatus(raw)
		if !s.Valid() {
			response.Error(c, apperror.BadRequest("статус фильтрі дұрыс емес"))
			return
		}
		status = &s
	}
	list, err := h.protocols.List(c.Request.Context(), status)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, protocolsDTO(list))
}

// EligibleApplications is manager/admin-only: approved applications not yet
// attached to any protocol — the "prepare protocol" candidate list.
func (h *ProtocolHandler) EligibleApplications(c *gin.Context) {
	list, err := h.protocols.EligibleApplications(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, applicationsDTO(list))
}

// GetDetail is manager/admin-only (committee members are always managers —
// see is_committee_member — so this already covers them).
func (h *ProtocolHandler) GetDetail(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("хаттама идентификаторы дұрыс емес"))
		return
	}
	detail, err := h.protocols.GetDetail(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, protocolDetailDTO(detail))
}

// Delete is manager/admin-only, and only while a protocol is still pending.
func (h *ProtocolHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("хаттама идентификаторы дұрыс емес"))
		return
	}
	if err := h.protocols.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type voteProtocolRequest struct {
	Decision domain.VoteDecision `json:"decision" binding:"required"`
	Reason   *string             `json:"reason"`
}

// Vote requires is_committee_member=true (a chairperson qualifies
// automatically, since it's a further flag on top of that, not a separate
// role).
func (h *ProtocolHandler) Vote(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("хаттама идентификаторы дұрыс емес"))
		return
	}
	var req voteProtocolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	protocol, err := h.protocols.Vote(c.Request.Context(), actorID, id, req.Decision, req.Reason)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, protocolDTO(protocol))
}
