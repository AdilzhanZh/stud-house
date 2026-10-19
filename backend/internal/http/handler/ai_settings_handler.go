package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type AISettingsHandler struct {
	settings *service.AISettingsService
}

func NewAISettingsHandler(settings *service.AISettingsService) *AISettingsHandler {
	return &AISettingsHandler{settings: settings}
}

type aiSettingsResponse struct {
	// APIKeyConfigured: an AI API key is set on the server, and Provider
	// says whose ("anthropic" or "openrouter"). The key itself is never
	// exposed or editable here.
	APIKeyConfigured      bool       `json:"api_key_configured"`
	Provider              string     `json:"provider"`
	AssistantEnabled      bool       `json:"assistant_enabled"`
	AssistantModel        string     `json:"assistant_model"`
	AssistantEffort       string     `json:"assistant_effort"`
	AssistantDailyLimit   int        `json:"assistant_daily_limit"`
	DocumentChecksEnabled bool       `json:"document_checks_enabled"`
	DocumentCheckModel    string     `json:"document_check_model"`
	UpdatedBy             *uuid.UUID `json:"updated_by"`
	UpdatedAt             *time.Time `json:"updated_at"`
	// Models are suggestions only — any model id may be typed in.
	Models  []string `json:"models"`
	Efforts []string `json:"efforts"`
	// APIKey describes the key in effect; the key itself never leaves the
	// server.
	APIKey aiKeyStatusResponse `json:"api_key"`
}

type aiKeyStatusResponse struct {
	Configured bool       `json:"configured"`
	Source     string     `json:"source"`
	Provider   string     `json:"provider"`
	SetAt      *time.Time `json:"set_at"`
	// CanSet: the server can store an admin-set key (an encryption secret
	// is configured).
	CanSet bool `json:"can_set"`
}

func (h *AISettingsHandler) keyStatus(st service.AIKeyStatus) aiKeyStatusResponse {
	return aiKeyStatusResponse{Configured: st.Configured, Source: st.Source, Provider: st.Provider, SetAt: st.SetAt, CanSet: h.settings.CanStoreKeys()}
}

func (h *AISettingsHandler) respond(c *gin.Context, s domain.AISettings) {
	response.OK(c, aiSettingsResponse{
		APIKeyConfigured:      h.settings.APIKeyPresent(),
		Provider:              h.settings.Provider(),
		AssistantEnabled:      s.AssistantEnabled,
		AssistantModel:        s.AssistantModel,
		AssistantEffort:       s.AssistantEffort,
		AssistantDailyLimit:   s.AssistantDailyLimit,
		DocumentChecksEnabled: s.DocumentChecksEnabled,
		DocumentCheckModel:    s.DocumentCheckModel,
		UpdatedBy:             s.UpdatedBy,
		UpdatedAt:             s.UpdatedAt,
		Models:                h.settings.SuggestedModels(c.Request.Context()),
		Efforts:               service.AIEfforts,
		APIKey:                h.keyStatus(h.settings.KeyStatus()),
	})
}

type setAPIKeyRequest struct {
	Key string `json:"key" binding:"required"`
}

// SetAPIKey is admin-only: verifies the key with its provider, stores it
// encrypted and switches to it immediately. The response never echoes it.
func (h *AISettingsHandler) SetAPIKey(c *gin.Context) {
	var req setAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest("API кілті жарамсыз"))
		return
	}
	actorID, _ := middleware.UserID(c)
	if _, err := h.settings.SetAPIKey(c.Request.Context(), actorID, req.Key); err != nil {
		response.Error(c, err)
		return
	}
	h.respond(c, h.settings.Current())
}

// ClearAPIKey is admin-only: removes the admin-set key (the environment's
// key, if any, takes over).
func (h *AISettingsHandler) ClearAPIKey(c *gin.Context) {
	if _, err := h.settings.ClearAPIKey(c.Request.Context()); err != nil {
		response.Error(c, err)
		return
	}
	h.respond(c, h.settings.Current())
}

// Get is admin-only: the AI settings in effect.
func (h *AISettingsHandler) Get(c *gin.Context) {
	h.respond(c, h.settings.Current())
}

type updateAISettingsRequest struct {
	AssistantEnabled      *bool  `json:"assistant_enabled" binding:"required"`
	AssistantModel        string `json:"assistant_model" binding:"required"`
	AssistantEffort       string `json:"assistant_effort" binding:"required"`
	AssistantDailyLimit   int    `json:"assistant_daily_limit" binding:"required"`
	DocumentChecksEnabled *bool  `json:"document_checks_enabled" binding:"required"`
	DocumentCheckModel    string `json:"document_check_model" binding:"required"`
}

// Update is admin-only: changes take effect immediately, no restart.
func (h *AISettingsHandler) Update(c *gin.Context) {
	var req updateAISettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	actorID, _ := middleware.UserID(c)
	saved, err := h.settings.Update(c.Request.Context(), actorID, domain.AISettings{
		AssistantEnabled:      *req.AssistantEnabled,
		AssistantModel:        req.AssistantModel,
		AssistantEffort:       req.AssistantEffort,
		AssistantDailyLimit:   req.AssistantDailyLimit,
		DocumentChecksEnabled: *req.DocumentChecksEnabled,
		DocumentCheckModel:    req.DocumentCheckModel,
	})
	if err != nil {
		response.Error(c, err)
		return
	}
	h.respond(c, saved)
}
