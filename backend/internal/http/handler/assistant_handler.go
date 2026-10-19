package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/reqlang"
	"student-house/pkg/response"
)

type AssistantHandler struct {
	assistant *service.AssistantService
}

func NewAssistantHandler(assistant *service.AssistantService) *AssistantHandler {
	return &AssistantHandler{assistant: assistant}
}

type chatMessageResponse struct {
	Role      string    `json:"role"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

type chatConversationResponse struct {
	Enabled        bool                  `json:"enabled"`
	ConversationID *uuid.UUID            `json:"conversation_id"`
	Messages       []chatMessageResponse `json:"messages"`
}

// Current is available to any authenticated user: their latest assistant
// conversation (empty when there is none, or their role changed since).
func (h *AssistantHandler) Current(c *gin.Context) {
	out := chatConversationResponse{Enabled: h.assistant.Enabled(), Messages: []chatMessageResponse{}}
	if !out.Enabled {
		response.OK(c, out)
		return
	}
	userID, _ := middleware.UserID(c)
	conv, err := h.assistant.Current(c.Request.Context(), userID)
	if err != nil {
		response.Error(c, err)
		return
	}
	out.ConversationID = conv.ID
	for _, m := range conv.Messages {
		out.Messages = append(out.Messages, chatMessageResponse{Role: m.Role, Text: m.Text, CreatedAt: m.CreatedAt})
	}
	response.OK(c, out)
}

type sendChatRequest struct {
	// ConversationID continues a conversation; omit it to start a new one.
	ConversationID *uuid.UUID `json:"conversation_id"`
	Message        string     `json:"message" binding:"required"`
}

type sendChatResponse struct {
	ConversationID uuid.UUID           `json:"conversation_id"`
	Reply          chatMessageResponse `json:"reply"`
}

// Send is available to any authenticated user: asks the assistant, which
// only looks up what this user is allowed to see.
func (h *AssistantHandler) Send(c *gin.Context) {
	var req sendChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	userID, _ := middleware.UserID(c)
	convID, reply, err := h.assistant.Send(c.Request.Context(), userID, req.ConversationID, req.Message, reqlang.Get(c))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, sendChatResponse{
		ConversationID: convID,
		Reply:          chatMessageResponse{Role: reply.Role, Text: reply.Text, CreatedAt: reply.CreatedAt},
	})
}
