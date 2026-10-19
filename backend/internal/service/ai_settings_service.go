package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

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

// AISettingsService holds the admin-editable AI settings and the API key
// in effect. Both are read on every assistant message and document check,
// so they're cached in memory and replaced on save — changes, including a
// new key, apply immediately, no restart needed. Settings default to the
// environment until an admin first saves; the key is the admin-set one if
// any, else the environment's.
type AISettingsService struct {
	repo     repository.AISettingsRepository
	defaults domain.AISettings
	sealer   *keySealer
	envKey   apiKey

	mu       sync.RWMutex
	current  domain.AISettings
	adminKey *apiKey
}

type apiKey struct {
	provider string
	key      string
	setAt    *time.Time
}

// AIKeyStatus describes the key in effect without revealing it.
type AIKeyStatus struct {
	Configured bool
	// Source is "admin" (set from the admin panel), "env" (server
	// environment) or "" when there is no key.
	Source   string
	Provider string
	SetAt    *time.Time
}

// NewAISettingsService: envProvider/envKey are the environment's key (both
// "" when none). sealSecret encrypts admin-set keys at rest; without it
// keys can only come from the environment.
func NewAISettingsService(repo repository.AISettingsRepository, defaults domain.AISettings, envProvider, envKey, sealSecret string) *AISettingsService {
	s := &AISettingsService{repo: repo, defaults: defaults, current: defaults, envKey: apiKey{provider: envProvider, key: envKey}}
	if sealer, err := newKeySealer(sealSecret); err != nil {
		log.Printf("admin-set AI API keys disabled: %v", err)
	} else {
		s.sealer = sealer
	}
	return s
}

// Load reads saved settings and the admin-set key into the cache; call
// once at startup.
func (s *AISettingsService) Load(ctx context.Context) error {
	saved, err := s.repo.Get(ctx)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return err
	}
	stored, err := s.repo.GetAPIKey(ctx)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return err
	}
	var admin *apiKey
	if stored != nil {
		if s.sealer == nil {
			log.Print("an admin-set AI API key is stored but cannot be decrypted (no encryption secret) — using the environment's key")
		} else if key, err := s.sealer.open(stored.Ciphertext); err != nil {
			log.Printf("the admin-set AI API key cannot be decrypted (was SETTINGS_ENCRYPTION_KEY/JWT_SECRET changed?) — set it again in the admin panel: %v", err)
		} else {
			setAt := stored.SetAt
			admin = &apiKey{provider: stored.Provider, key: key, setAt: &setAt}
		}
	}
	s.mu.Lock()
	if saved != nil {
		s.current = *saved
	}
	s.adminKey = admin
	s.mu.Unlock()
	return nil
}

// key is the key in effect; call with s.mu held.
func (s *AISettingsService) key() apiKey {
	if s.adminKey != nil {
		return *s.adminKey
	}
	return s.envKey
}

// validModel checks a model id against provider's id format: OpenRouter
// ids are "vendor/model", Anthropic ids have no slash.
func validModel(provider, model string) error {
	switch {
	case model == "" || len(model) > maxAIModelLength || strings.ContainsFunc(model, unicode.IsSpace):
		return apperror.BadRequest("модель атауы жарамсыз")
	case provider == AIProviderOpenRouter && !strings.Contains(model, "/"):
		return apperror.BadRequest("OpenRouter модель атауы «әзірлеуші/модель» түрінде болуы керек, мысалы nvidia/nemotron-3.5-super-vl:free")
	case provider == AIProviderAnthropic && strings.Contains(model, "/"):
		return apperror.BadRequest("Anthropic модель атауында «/» болмайды, мысалы claude-opus-5-5")
	}
	return nil
}

// Current returns the settings in effect. A model that doesn't fit the
// current provider (e.g. a Claude id after an OpenRouter key was set) is
// replaced by that provider's default until an admin picks another.
func (s *AISettingsService) Current() domain.AISettings {
	if s == nil {
		return domain.AISettings{}
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.current
	if p := s.key().provider; p != "" {
		if validModel(p, out.AssistantModel) != nil {
			out.AssistantModel = defaultAIModel[p]
		}
		if validModel(p, out.DocumentCheckModel) != nil {
			out.DocumentCheckModel = defaultAIModel[p]
		}
	}
	return out
}

// APIKeyPresent reports whether an AI API key is in effect — without one
// no AI feature runs, whatever the settings say.
func (s *AISettingsService) APIKeyPresent() bool { return s.Provider() != "" }

// Provider is AIProviderAnthropic, AIProviderOpenRouter, or "" (no key).
func (s *AISettingsService) Provider() string {
	p, _ := s.Credentials()
	return p
}

// Credentials returns the provider and key in effect.
func (s *AISettingsService) Credentials() (provider, key string) {
	if s == nil {
		return "", ""
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	k := s.key()
	return k.provider, k.key
}

func (s *AISettingsService) KeyStatus() AIKeyStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	switch {
	case s.adminKey != nil:
		return AIKeyStatus{Configured: true, Source: "admin", Provider: s.adminKey.provider, SetAt: s.adminKey.setAt}
	case s.envKey.provider != "":
		return AIKeyStatus{Configured: true, Source: "env", Provider: s.envKey.provider}
	}
	return AIKeyStatus{}
}

// CanStoreKeys reports whether admin-set keys can be saved (an encryption
// secret is configured).
func (s *AISettingsService) CanStoreKeys() bool { return s != nil && s.sealer != nil }

// SuggestedModels are offered to admins in the model field. Never empty:
// if OpenRouter's model list can't be fetched, its default is offered.
func (s *AISettingsService) SuggestedModels(ctx context.Context) []string {
	if s.Provider() == AIProviderOpenRouter {
		if models := freeOpenRouterModels.list(ctx); len(models) > 0 {
			return models
		}
		return []string{defaultAIModel[AIProviderOpenRouter]}
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
	provider := s.Provider()
	in.AssistantModel = strings.TrimSpace(in.AssistantModel)
	in.DocumentCheckModel = strings.TrimSpace(in.DocumentCheckModel)
	if err := validModel(provider, in.AssistantModel); err != nil {
		return domain.AISettings{}, err
	}
	if err := validModel(provider, in.DocumentCheckModel); err != nil {
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
	return s.Current(), nil
}

// keyProvider tells the provider from a key's prefix.
func keyProvider(key string) (string, error) {
	switch {
	case strings.HasPrefix(key, "sk-or-"):
		return AIProviderOpenRouter, nil
	case strings.HasPrefix(key, "sk-ant-"):
		return AIProviderAnthropic, nil
	}
	return "", apperror.BadRequest("кілт танылмады: OpenRouter кілті «sk-or-», Anthropic кілті «sk-ant-» деп басталады")
}

// SetAPIKey checks the key with its provider, then stores it encrypted and
// switches to it immediately. The key is never returned afterwards.
func (s *AISettingsService) SetAPIKey(ctx context.Context, actorID uuid.UUID, key string) (AIKeyStatus, error) {
	if s.sealer == nil {
		return AIKeyStatus{}, apperror.BadRequest("серверде шифрлау кілті (SETTINGS_ENCRYPTION_KEY немесе JWT_SECRET) жоқ, API кілтін сақтау мүмкін емес")
	}
	key = strings.TrimSpace(key)
	if key == "" || len(key) > 512 || strings.ContainsFunc(key, unicode.IsSpace) {
		return AIKeyStatus{}, apperror.BadRequest("API кілті жарамсыз")
	}
	provider, err := keyProvider(key)
	if err != nil {
		return AIKeyStatus{}, err
	}
	if err := verifyAPIKey(ctx, provider, key); err != nil {
		return AIKeyStatus{}, err
	}
	sealed, err := s.sealer.seal(key)
	if err != nil {
		return AIKeyStatus{}, err
	}
	stored := &domain.AIAPIKey{Provider: provider, Ciphertext: sealed, SetBy: &actorID}
	if err := s.repo.SaveAPIKey(ctx, stored); err != nil {
		return AIKeyStatus{}, err
	}
	setAt := stored.SetAt
	s.mu.Lock()
	s.adminKey = &apiKey{provider: provider, key: key, setAt: &setAt}
	s.mu.Unlock()
	return s.KeyStatus(), nil
}

// ClearAPIKey removes the admin-set key; the environment's key, if any,
// takes over again.
func (s *AISettingsService) ClearAPIKey(ctx context.Context) (AIKeyStatus, error) {
	if err := s.repo.DeleteAPIKey(ctx); err != nil {
		return AIKeyStatus{}, err
	}
	s.mu.Lock()
	s.adminKey = nil
	s.mu.Unlock()
	return s.KeyStatus(), nil
}

const apiKeyVerifyTimeout = 15 * time.Second

// verifyAPIKey makes one cheap authenticated call to the provider so a
// mistyped or revoked key is rejected when it's set, not on first use.
func verifyAPIKey(ctx context.Context, provider, key string) error {
	ctx, cancel := context.WithTimeout(ctx, apiKeyVerifyTimeout)
	defer cancel()
	var status int
	switch provider {
	case AIProviderAnthropic:
		client := anthropic.NewClient(option.WithAPIKey(key), option.WithMaxRetries(0))
		_, err := client.Models.List(ctx, anthropic.ModelListParams{Limit: anthropic.Int(1)})
		var apiErr *anthropic.Error
		switch {
		case err == nil:
			return nil
		case errors.As(err, &apiErr):
			status = apiErr.StatusCode
		default:
			log.Printf("verifying Anthropic API key: %v", err)
			return apperror.New(http.StatusBadGateway, "key_check_failed", "кілтті тексеру мүмкін болмады (провайдерге қосылу қатесі), кейінірек қайталап көріңіз")
		}
	case AIProviderOpenRouter:
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, openRouterBaseURL+"/key", nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+key)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("verifying OpenRouter API key: %v", err)
			return apperror.New(http.StatusBadGateway, "key_check_failed", "кілтті тексеру мүмкін болмады (провайдерге қосылу қатесі), кейінірек қайталап көріңіз")
		}
		resp.Body.Close()
		status = resp.StatusCode
		if status == http.StatusOK {
			return nil
		}
	default:
		return fmt.Errorf("unknown provider %q", provider)
	}
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		return apperror.BadRequest("кілт жарамсыз: провайдер оны қабылдамады")
	}
	log.Printf("verifying %s API key: unexpected status %d", provider, status)
	return apperror.New(http.StatusBadGateway, "key_check_failed", "кілтті тексеру мүмкін болмады (провайдерге қосылу қатесі), кейінірек қайталап көріңіз")
}
