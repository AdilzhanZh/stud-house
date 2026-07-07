package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type BenefitHandler struct {
	benefits *service.BenefitService
}

func NewBenefitHandler(benefits *service.BenefitService) *BenefitHandler {
	return &BenefitHandler{benefits: benefits}
}

type createBenefitRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

func (h *BenefitHandler) Create(c *gin.Context) {
	var req createBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	createdBy, _ := middleware.UserID(c)
	b, err := h.benefits.Create(c.Request.Context(), req.Name, req.Description, createdBy)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, benefitDTO(b))
}

func (h *BenefitHandler) List(c *gin.Context) {
	list, err := h.benefits.List(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, benefitsDTO(list))
}

func (h *BenefitHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	b, err := h.benefits.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, benefitDTO(b))
}

type updateBenefitRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

func (h *BenefitHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	var req updateBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	b, err := h.benefits.Update(c.Request.Context(), id, req.Name, req.Description)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, benefitDTO(b))
}

func (h *BenefitHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	if err := h.benefits.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type addBenefitFieldRequest struct {
	FieldName string `json:"field_name" binding:"required"`
	FieldType string `json:"field_type" binding:"required"`
}

func (h *BenefitHandler) AddField(c *gin.Context) {
	benefitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	var req addBenefitFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	f, err := h.benefits.AddField(c.Request.Context(), benefitID, req.FieldName, req.FieldType)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, benefitFieldDTO(f))
}

func (h *BenefitHandler) ListFields(c *gin.Context) {
	benefitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	fields, err := h.benefits.ListFields(c.Request.Context(), benefitID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, benefitFieldsDTO(fields))
}

func (h *BenefitHandler) DeleteField(c *gin.Context) {
	fieldID, err := uuid.Parse(c.Param("fieldId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid field id"))
		return
	}
	if err := h.benefits.DeleteField(c.Request.Context(), fieldID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type addRequiredDocumentRequest struct {
	DocumentName string `json:"document_name" binding:"required"`
}

func (h *BenefitHandler) AddRequiredDocument(c *gin.Context) {
	benefitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	var req addRequiredDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	d, err := h.benefits.AddRequiredDocument(c.Request.Context(), benefitID, req.DocumentName)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, benefitRequiredDocumentDTO(d))
}

func (h *BenefitHandler) ListRequiredDocuments(c *gin.Context) {
	benefitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	docs, err := h.benefits.ListRequiredDocuments(c.Request.Context(), benefitID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, benefitRequiredDocumentsDTO(docs))
}

func (h *BenefitHandler) DeleteRequiredDocument(c *gin.Context) {
	docID, err := uuid.Parse(c.Param("documentId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid document id"))
		return
	}
	if err := h.benefits.DeleteRequiredDocument(c.Request.Context(), docID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type assignBenefitRequest struct {
	BenefitID uuid.UUID `json:"benefit_id" binding:"required"`
}

// AssignBenefit records a minimal "student holds benefit" fact used by room
// restriction validation; it is not the full application workflow.
func (h *BenefitHandler) AssignBenefit(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid student id"))
		return
	}
	var req assignBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	assignedBy, _ := middleware.UserID(c)
	sb, err := h.benefits.AssignBenefit(c.Request.Context(), studentID, req.BenefitID, assignedBy)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, studentBenefitDTO(sb))
}

func (h *BenefitHandler) ListStudentBenefits(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid student id"))
		return
	}
	list, err := h.benefits.ListStudentBenefits(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, studentBenefitsDTO(list))
}

func (h *BenefitHandler) RevokeBenefit(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid student id"))
		return
	}
	benefitID, err := uuid.Parse(c.Param("benefitId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid benefit id"))
		return
	}
	if err := h.benefits.RevokeBenefit(c.Request.Context(), studentID, benefitID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
