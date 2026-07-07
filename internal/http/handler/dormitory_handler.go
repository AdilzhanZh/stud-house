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

type DormitoryHandler struct {
	dormitories *service.DormitoryService
}

func NewDormitoryHandler(dormitories *service.DormitoryService) *DormitoryHandler {
	return &DormitoryHandler{dormitories: dormitories}
}

type createDormitoryRequest struct {
	Name             string  `json:"name" binding:"required"`
	Address          string  `json:"address" binding:"required"`
	TotalCapacity    int     `json:"total_capacity"`
	PaymentQRCodeURL *string `json:"payment_qr_code_url"`
}

func (h *DormitoryHandler) Create(c *gin.Context) {
	var req createDormitoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	createdBy, _ := middleware.UserID(c)
	d, err := h.dormitories.Create(c.Request.Context(), req.Name, req.Address, req.TotalCapacity, req.PaymentQRCodeURL, createdBy)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, dormitoryDTO(d))
}

func (h *DormitoryHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid dormitory id"))
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
	list, err := h.dormitories.List(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoriesDTO(list))
}

type updateDormitoryRequest struct {
	Name             string  `json:"name" binding:"required"`
	Address          string  `json:"address" binding:"required"`
	TotalCapacity    int     `json:"total_capacity"`
	PaymentQRCodeURL *string `json:"payment_qr_code_url"`
}

func (h *DormitoryHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid dormitory id"))
		return
	}
	var req updateDormitoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	d, err := h.dormitories.Update(c.Request.Context(), id, req.Name, req.Address, req.TotalCapacity, req.PaymentQRCodeURL)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, dormitoryDTO(d))
}

func (h *DormitoryHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("invalid dormitory id"))
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
		response.Error(c, apperror.BadRequest("invalid dormitory id"))
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
		response.Error(c, apperror.BadRequest("invalid dormitory id"))
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
		response.Error(c, apperror.BadRequest("invalid dormitory id"))
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
		response.Error(c, apperror.BadRequest("invalid image id"))
		return
	}
	if err := h.dormitories.DeleteImage(c.Request.Context(), imageID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
