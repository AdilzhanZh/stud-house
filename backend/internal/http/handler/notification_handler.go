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

type broadcastNotificationRequest struct {
	Audience    string     `json:"audience" binding:"required"`
	DormitoryID *uuid.UUID `json:"dormitory_id"`
	StudentID   *uuid.UUID `json:"student_id"`
	Title       string     `json:"title" binding:"required"`
	Body        string     `json:"body" binding:"required"`
}

type NotificationHandler struct {
	notifications *service.NotificationService
}

func NewNotificationHandler(notifications *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifications: notifications}
}

func (h *NotificationHandler) ListMine(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	list, err := h.notifications.ListMine(c.Request.Context(), userID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, notificationsDTO(list))
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("хабарландыру идентификаторы дұрыс емес"))
		return
	}
	userID, _ := middleware.UserID(c)
	if err := h.notifications.MarkRead(c.Request.Context(), id, userID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotificationHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("хабарландыру идентификаторы дұрыс емес"))
		return
	}
	userID, _ := middleware.UserID(c)
	if err := h.notifications.Delete(c.Request.Context(), id, userID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotificationHandler) ClearAll(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	if err := h.notifications.ClearAll(c.Request.Context(), userID); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *NotificationHandler) Broadcast(c *gin.Context) {
	var req broadcastNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	sent, err := h.notifications.Broadcast(
		c.Request.Context(),
		service.BroadcastAudience(req.Audience),
		req.DormitoryID,
		req.StudentID,
		req.Title,
		req.Body,
	)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, gin.H{"sent": sent})
}
