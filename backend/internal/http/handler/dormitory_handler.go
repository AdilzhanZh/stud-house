package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type DormitoryHandler struct {
	dormitories *service.DormitoryService
}

func NewDormitoryHandler(dormitories *service.DormitoryService) *DormitoryHandler {
	return &DormitoryHandler{dormitories: dormitories}
}

// dormitoryRequest is shared by create/update — the wire representation
// closely mirrors service.DormitoryInput, except dates come in as
// "2006-01-02" strings (frontend <input type="date">).
type dormitoryRequest struct {
	Name                  string                `json:"name" binding:"required"`
	Address               string                `json:"address" binding:"required"`
	Phone                 *string               `json:"phone"`
	Type                  *domain.DormitoryType `json:"dorm_type"`
	FloorCount            *int                  `json:"floor_count"`
	TotalRoomsTarget      *int                  `json:"total_rooms_target"`
	TotalCapacity         int                   `json:"total_capacity"`
	RoomsMale             *int                  `json:"rooms_male"`
	RoomsFemale           *int                  `json:"rooms_female"`
	RoomsMixed            *int                  `json:"rooms_mixed"`
	MonthlyPayment        *float64              `json:"monthly_payment"`
	YearlyPayment         *float64              `json:"yearly_payment"`
	BuiltYear             *string               `json:"built_year"`
	CommissionedYear      *string               `json:"commissioned_year"`
	OwnershipForm         *string               `json:"ownership_form"`
	ClosedForApplications bool                  `json:"closed_for_applications"`
}

func (req dormitoryRequest) toInput() (service.DormitoryInput, error) {
	builtYear, err := parseOptionalDate(req.BuiltYear)
	if err != nil {
		return service.DormitoryInput{}, apperror.BadRequest("салынған жылы дұрыс емес, ЖЖЖЖ-АА-КК форматында болуы керек")
	}
	commissionedYear, err := parseOptionalDate(req.CommissionedYear)
	if err != nil {
		return service.DormitoryInput{}, apperror.BadRequest("пайдалануға берілген жылы дұрыс емес, ЖЖЖЖ-АА-КК форматында болуы керек")
	}
	return service.DormitoryInput{
		Name:                  req.Name,
		Address:               req.Address,
		Phone:                 req.Phone,
		Type:                  req.Type,
		FloorCount:            req.FloorCount,
		TotalRoomsTarget:      req.TotalRoomsTarget,
		TotalCapacity:         req.TotalCapacity,
		RoomsMale:             req.RoomsMale,
		RoomsFemale:           req.RoomsFemale,
		RoomsMixed:            req.RoomsMixed,
		MonthlyPayment:        req.MonthlyPayment,
		YearlyPayment:         req.YearlyPayment,
		BuiltYear:             builtYear,
		CommissionedYear:      commissionedYear,
		OwnershipForm:         req.OwnershipForm,
		ClosedForApplications: req.ClosedForApplications,
	}, nil
}

func parseOptionalDate(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (h *DormitoryHandler) Create(c *gin.Context) {
	var req dormitoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	in, err := req.toInput()
	if err != nil {
		response.Error(c, err)
		return
	}
	createdBy, _ := middleware.UserID(c)
	d, err := h.dormitories.Create(c.Request.Context(), in, createdBy)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, dormitoryDTO(d))
}

func (h *DormitoryHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	d, err := h.dormitories.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoryDTO(d))
}

func (h *DormitoryHandler) List(c *gin.Context) {
	openOnly := c.Query("open_only") == "true"
	list, err := h.dormitories.List(c.Request.Context(), openOnly)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoriesDTO(list))
}

func (h *DormitoryHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	var req dormitoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	in, err := req.toInput()
	if err != nil {
		response.Error(c, err)
		return
	}
	d, err := h.dormitories.Update(c.Request.Context(), id, in)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoryDTO(d))
}

func (h *DormitoryHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	if err := h.dormitories.Delete(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

// GetCapacity returns the "allocated / total" bed progress for a dormitory.
func (h *DormitoryHandler) GetCapacity(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	capacity, err := h.dormitories.GetCapacity(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoryCapacityDTO(capacity))
}

type addImageRequest struct {
	ImageURL string `json:"image_url" binding:"required"`
}

func (h *DormitoryHandler) AddImage(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	var req addImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	img, err := h.dormitories.AddImage(c.Request.Context(), dormitoryID, req.ImageURL)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, dormitoryImageDTO(img))
}

func (h *DormitoryHandler) ListImages(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	images, err := h.dormitories.ListImages(c.Request.Context(), dormitoryID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoryImagesDTO(images))
}

func (h *DormitoryHandler) DeleteImage(c *gin.Context) {
	imageID, err := uuid.Parse(c.Param("imageId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("сурет идентификаторы дұрыс емес"))
		return
	}
	if err := h.dormitories.DeleteImage(c.Request.Context(), imageID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

type addDormitoryRequiredDocumentRequest struct {
	DocumentID uuid.UUID `json:"document_id" binding:"required"`
}

func (h *DormitoryHandler) AddRequiredDocument(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	var req addDormitoryRequiredDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	d, err := h.dormitories.AddRequiredDocument(c.Request.Context(), dormitoryID, req.DocumentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, dormitoryRequiredDocumentDTO(d))
}

func (h *DormitoryHandler) ListRequiredDocuments(c *gin.Context) {
	dormitoryID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("жатақхана идентификаторы дұрыс емес"))
		return
	}
	docs, err := h.dormitories.ListRequiredDocuments(c.Request.Context(), dormitoryID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoryRequiredDocumentsDTO(docs))
}

func (h *DormitoryHandler) DeleteRequiredDocument(c *gin.Context) {
	docID, err := uuid.Parse(c.Param("documentId"))
	if err != nil {
		response.Error(c, apperror.BadRequest("құжат идентификаторы дұрыс емес"))
		return
	}
	if err := h.dormitories.DeleteRequiredDocument(c.Request.Context(), docID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
