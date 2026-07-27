package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type sendFeedbackRequest struct {
	Message string `json:"message" binding:"required"`
}

type FeedbackHandler struct {
	feedback *service.FeedbackService
}

func NewFeedbackHandler(feedback *service.FeedbackService) *FeedbackHandler {
	return &FeedbackHandler{feedback: feedback}
}

// Send is available to any authenticated user — a bug report or suggestion,
// delivered to every admin.
func (h *FeedbackHandler) Send(c *gin.Context) {
	var req sendFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	if err := h.feedback.Send(c.Request.Context(), actorID, req.Message); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
