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
	Priority    int    `json:"priority" binding:"required,min=1,max=10"`
}

func (h *BenefitHandler) Create(c *gin.Context) {
	var req createBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	createdBy, _ := middleware.UserID(c)
	b, err := h.benefits.Create(c.Request.Context(), req.Name, req.Description, req.Priority, createdBy)
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
		response.Error(c, apperror.BadRequest("льгота идентификаторы дұрыс емес"))
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
	Priority    int    `json:"priority" binding:"required,min=1,max=10"`
}

func (h *BenefitHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("льгота идентификаторы дұрыс емес"))
		return
	}
	var req updateBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	b, err := h.benefits.Update(c.Request.Context(), id, req.Name, req.Description, req.Priority)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, benefitDTO(b))
}

func (h *BenefitHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("льгота идентификаторы дұрыс емес"))
		return
	}
	if err := h.benefits.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type addRequiredDocumentRequest struct {
	DocumentID uuid.UUID `json:"document_id" binding:"required"`
}

func (h *BenefitHandler) AddRequiredDocument(c *gin.Context) {
	benefitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("льгота идентификаторы дұрыс емес"))
		return
	}
	var req addRequiredDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	d, err := h.benefits.AddRequiredDocument(c.Request.Context(), benefitID, req.DocumentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, benefitRequiredDocumentDTO(d))
}

func (h *BenefitHandler) ListRequiredDocuments(c *gin.Context) {
	benefitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("льгота идентификаторы дұрыс емес"))
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
		response.Error(c, apperror.BadRequest("құжат идентификаторы дұрыс емес"))
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
		response.Error(c, apperror.BadRequest("студент идентификаторы дұрыс емес"))
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

// AssignOwnBenefit is student-only: a student self-declares that a benefit
// applies to them (e.g. while filling in a dormitory application), as
// opposed to AssignBenefit which is an admin/manager assigning on a
// student's behalf.
func (h *BenefitHandler) AssignOwnBenefit(c *gin.Context) {
	studentID, ok := middleware.UserID(c)
	if !ok {
		response.Error(c, apperror.Unauthorized("авторизация қажет"))
		return
	}
	var req assignBenefitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	sb, err := h.benefits.AssignBenefit(c.Request.Context(), studentID, req.BenefitID, studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, studentBenefitDTO(sb))
}

func (h *BenefitHandler) ListStudentBenefits(c *gin.Context) {
	studentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("студент идентификаторы дұрыс емес"))
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
		response.Error(c, apperror.BadRequest("студент идентификаторы дұрыс емес"))
		return
	}
	benefitID, err := uuid.Parse(c.Param("benefitId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("льгота идентификаторы дұрыс емес"))
		return
	}
	if err := h.benefits.RevokeBenefit(c.Request.Context(), studentID, benefitID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
