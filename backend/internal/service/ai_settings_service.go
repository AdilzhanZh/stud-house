package service

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"unicode"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// AI providers (see config.Config.AIProvider).
const (
	AIProviderAnthropic  = "anthropic"
	AIProviderOpenRouter = "openrouter"
)

// AIModels are the Claude models suggested for the Anthropic API, most
// capable first. OpenRouter's suggestions are its current free models.
// Admins may type any other model id.
var AIModels = []string{"claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"}

// Default models per provider, used until an admin picks others. The
// OpenRouter default is free and reads images, so it also does checks.
var defaultAIModel = map[string]string{
	AIProviderAnthropic:  "claude-opus-5-5",
	AIProviderOpenRouter: "nvidia/nemotron-3.5-super-vl:free",
}

const maxAIModelLength = 128

// AIEfforts are the effort levels offered for the assistant.
var AIEfforts = []string{"low", "medium", "high"}

// AISettingsService holds the admin-editable AI settings. They are read on
// every assistant message and document check, so they're cached in memory
// and replaced on save — changes apply immediately, no restart needed.
// Defaults (until an admin first saves) come from the environment.
type AISettingsService struct {
	repo     repository.AISettingsRepository
	defaults domain.AISettings
	provider string

	mu      sync.RWMutex
	current domain.AISettings
}

// NewAISettingsService: provider is "" when no API key is set. Default
// models that are empty or don't fit the provider are replaced with the
// provider's default.
func NewAISettingsService(repo repository.AISettingsRepository, defaults domain.AISettings, provider string) *AISettingsService {
	s := &AISettingsService{repo: repo, provider: provider}
	if provider != "" && s.validModel(defaults.AssistantModel) != nil {
		defaults.AssistantModel = defaultAIModel[provider]
	}
	if provider != "" && s.validModel(defaults.DocumentCheckModel) != nil {
		defaults.DocumentCheckModel = defaultAIModel[provider]
	}
	s.defaults, s.current = defaults, defaults
	return s
}

// Load reads saved settings into the cache; call once at startup.
func (s *AISettingsService) Load(ctx context.Context) error {
	saved, err := s.repo.Get(ctx)
	if errors.Is(err, repository.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	// Models saved for the other provider (e.g. Claude ids before switching
	// to an OpenRouter key) wouldn't work; use this provider's defaults
	// until an admin picks new ones.
	if s.validModel(saved.AssistantModel) != nil {
		saved.AssistantModel = s.defaults.AssistantModel
	}
	if s.validModel(saved.DocumentCheckModel) != nil {
		saved.DocumentCheckModel = s.defaults.DocumentCheckModel
	}
	s.mu.Lock()
	s.current = *saved
	s.mu.Unlock()
	return nil
}

// validModel checks a typed-in model id against the provider's id format:
// OpenRouter ids are "vendor/model", Anthropic ids have no slash.
func (s *AISettingsService) validModel(model string) error {
	switch {
	case model == "" || len(model) > maxAIModelLength || strings.ContainsFunc(model, unicode.IsSpace):
		return apperror.BadRequest("модель атауы жарамсыз")
	case s.provider == AIProviderOpenRouter && !strings.Contains(model, "/"):
		return apperror.BadRequest("OpenRouter модель атауы «әзірлеуші/модель» түрінде болуы керек, мысалы nvidia/nemotron-3.5-super-vl:free")
	case s.provider == AIProviderAnthropic && strings.Contains(model, "/"):
		return apperror.BadRequest("Anthropic модель атауында «/» болмайды, мысалы claude-opus-5-5")
	}
	return nil
}

// Current returns the settings in effect.
func (s *AISettingsService) Current() domain.AISettings {
	if s == nil {
		return domain.AISettings{}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current
}

// APIKeyPresent reports whether an AI API key is set — without it no AI
// feature runs, whatever the settings say.
func (s *AISettingsService) APIKeyPresent() bool { return s != nil && s.provider != "" }

// Provider is AIProviderAnthropic, AIProviderOpenRouter, or "" (no key).
func (s *AISettingsService) Provider() string {
	if s == nil {
		return ""
	}
	return s.provider
}

// SuggestedModels are offered to admins in the model field.
func (s *AISettingsService) SuggestedModels(ctx context.Context) []string {
	if s.Provider() == AIProviderOpenRouter {
		return freeOpenRouterModels.list(ctx)
	}
	return AIModels
}

func (s *AISettingsService) AssistantActive() bool {
	return s.APIKeyPresent() && s.Current().AssistantEnabled
}

func (s *AISettingsService) DocumentChecksActive() bool {
	return s.APIKeyPresent() && s.Current().DocumentChecksEnabled
}

func (s *AISettingsService) Update(ctx context.Context, actorID uuid.UUID, in domain.AISettings) (domain.AISettings, error) {
	in.AssistantModel = strings.TrimSpace(in.AssistantModel)
	in.DocumentCheckModel = strings.TrimSpace(in.DocumentCheckModel)
	if err := s.validModel(in.AssistantModel); err != nil {
		return domain.AISettings{}, err
	}
	if err := s.validModel(in.DocumentCheckModel); err != nil {
		return domain.AISettings{}, err
	}
	if !slices.Contains(AIEfforts, in.AssistantEffort) {
		return domain.AISettings{}, apperror.BadRequest("effort деңгейі жарамсыз")
	}
	if in.AssistantDailyLimit < 1 || in.AssistantDailyLimit > 1000 {
		return domain.AISettings{}, apperror.BadRequest("күндік лимит 1 мен 1000 аралығында болуы керек")
	}
	in.UpdatedBy = &actorID
	if err := s.repo.Save(ctx, &in); err != nil {
		return domain.AISettings{}, err
	}
	s.mu.Lock()
	s.current = in
	s.mu.Unlock()
	return in, nil
}
