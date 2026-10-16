package service

import (
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// AIModels are the Claude models an admin may pick, most capable first.
var AIModels = []string{"claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"}

// AIEfforts are the effort levels offered for the assistant.
var AIEfforts = []string{"low", "medium", "high"}

// AISettingsService holds the admin-editable AI settings. They are read on
// every assistant message and document check, so they're cached in memory
// and replaced on save — changes apply immediately, no restart needed.
// Defaults (until an admin first saves) come from the environment.
type AISettingsService struct {
	repo          repository.AISettingsRepository
	defaults      domain.AISettings
	apiKeyPresent bool

	mu      sync.RWMutex
	current domain.AISettings
}

func NewAISettingsService(repo repository.AISettingsRepository, defaults domain.AISettings, apiKeyPresent bool) *AISettingsService {
	return &AISettingsService{repo: repo, defaults: defaults, apiKeyPresent: apiKeyPresent, current: defaults}
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
	s.mu.Lock()
	s.current = *saved
	s.mu.Unlock()
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

// APIKeyPresent reports whether ANTHROPIC_API_KEY is set — without it no AI
// feature runs, whatever the settings say.
func (s *AISettingsService) APIKeyPresent() bool { return s != nil && s.apiKeyPresent }

func (s *AISettingsService) AssistantActive() bool {
	return s.APIKeyPresent() && s.Current().AssistantEnabled
}

func (s *AISettingsService) DocumentChecksActive() bool {
	return s.APIKeyPresent() && s.Current().DocumentChecksEnabled
}

func (s *AISettingsService) Update(ctx context.Context, actorID uuid.UUID, in domain.AISettings) (domain.AISettings, error) {
	if !slices.Contains(AIModels, in.AssistantModel) || !slices.Contains(AIModels, in.DocumentCheckModel) {
		return domain.AISettings{}, apperror.BadRequest("модель жарамсыз")
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
