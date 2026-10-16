package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

// DocumentHandler manages the shared required-document catalog that
// benefits and dormitories pick their required documents from.
type DocumentHandler struct {
	documents *service.DocumentService
}

func NewDocumentHandler(documents *service.DocumentService) *DocumentHandler {
	return &DocumentHandler{documents: documents}
}

type createDocumentRequest struct {
	NameKk       string `json:"name_kk"`
	NameRu       string `json:"name_ru"`
	ValidityDays *int   `json:"validity_days"`
}

func (h *DocumentHandler) Create(c *gin.Context) {
	var req createDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	d, err := h.documents.Create(c.Request.Context(), req.NameKk, req.NameRu, req.ValidityDays)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, requiredDocumentDTO(d))
}

func (h *DocumentHandler) List(c *gin.Context) {
	list, err := h.documents.List(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, requiredDocumentsDTO(list))
}

type setValidityRequest struct {
	ValidityDays *int `json:"validity_days"`
}

// SetValidity sets or clears (validity_days: null) a document's validity
// period.
func (h *DocumentHandler) SetValidity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("құжат идентификаторы дұрыс емес"))
		return
	}
	var req setValidityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.documents.SetValidityDays(c.Request.Context(), id, req.ValidityDays); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *DocumentHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("құжат идентификаторы дұрыс емес"))
		return
	}
	if err := h.documents.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
