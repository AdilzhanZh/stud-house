package handler

import (
	"github.com/gin-gonic/gin"

	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type PushHandler struct {
	push *service.PushService
}

func NewPushHandler(push *service.PushService) *PushHandler {
	return &PushHandler{push: push}
}

// Config tells the browser whether push is on and which key to subscribe
// with; the page hides its push switch when it's off.
func (h *PushHandler) Config(c *gin.Context) {
	response.OK(c, gin.H{"enabled": h.push.Enabled(), "public_key": h.push.PublicKey()})
}

// pushSubscriptionRequest is PushSubscription.toJSON() as the browser sends it.
type pushSubscriptionRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
	Keys     struct {
		P256dh string `json:"p256dh" binding:"required"`
		Auth   string `json:"auth" binding:"required"`
	} `json:"keys" binding:"required"`
}

func (h *PushHandler) Subscribe(c *gin.Context) {
	var req pushSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	userID, _ := middleware.UserID(c)
	if err := h.push.Subscribe(c.Request.Context(), userID, req.Endpoint, req.Keys.P256dh, req.Keys.Auth, c.Request.UserAgent()); err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, gin.H{"subscribed": true})
}

type pushUnsubscribeRequest struct {
	Endpoint string `json:"endpoint" binding:"required"`
}

func (h *PushHandler) Unsubscribe(c *gin.Context) {
	var req pushUnsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	userID, _ := middleware.UserID(c)
	if err := h.push.Unsubscribe(c.Request.Context(), userID, req.Endpoint); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"subscribed": false})
}
