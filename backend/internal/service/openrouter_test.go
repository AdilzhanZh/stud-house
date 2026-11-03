package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

func TestExtractJSONObject(t *testing.T) {
	cases := map[string]string{
		`{"a":1}`:                             `{"a":1}`,
		"```json\n{\"a\":{\"b\":2}}\n```":     `{"a":{"b":2}}`,
		`Here is the result: {"a":1} — done.`: `{"a":1}`,
		`no json`:                             `no json`,
	}
	for in, want := range cases {
		if got := extractJSONObject(in); got != want {
			t.Errorf("extractJSONObject(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDocumentCheckSchema(t *testing.T) {
	if documentCheckSchema["type"] != "object" || documentCheckSchema["additionalProperties"] != false {
		t.Fatalf("schema is not a closed object: %v", documentCheckSchema)
	}
	props, _ := documentCheckSchema["properties"].(map[string]any)
	names, _ := props["names_student"].(map[string]any)
	if enum, _ := names["enum"].([]any); len(enum) != 4 {
		t.Errorf("names_student enum = %v, want 4 values", names["enum"])
	}
	required, _ := json.Marshal(documentCheckSchema["required"])
	var req []string
	_ = json.Unmarshal(required, &req)
	if len(req) != len(props) || !slices.Contains(req, "issue_date") {
		t.Errorf("every field must be required, got %v", req)
	}
}

func TestOpenRouterMessageText(t *testing.T) {
	var m orMessage
	if err := json.Unmarshal([]byte(`{"role":"assistant","content":[{"type":"text","text":"Сәлем"},{"type":"text","text":"!"}]}`), &m); err != nil {
		t.Fatal(err)
	}
	if got := m.textContent(); got != "Сәлем!" {
		t.Errorf("textContent = %q", got)
	}
}

func TestValidModel(t *testing.T) {
	cases := []struct {
		provider string
		model    string
		ok       bool
	}{
		{AIProviderOpenRouter, "nvidia/nemotron-3.5-super-vl:free", true},
		{AIProviderOpenRouter, "claude-opus-5-5", false},
		{AIProviderOpenRouter, "google/gemma 4", false},
		{AIProviderOpenRouter, "", false},
		{AIProviderAnthropic, "claude-sonnet-5-5", true},
		{AIProviderAnthropic, "anthropic/claude-sonnet-5-5", false},
	}
	for _, c := range cases {
		if err := validModel(c.provider, c.model); (err == nil) != c.ok {
			t.Errorf("%s validModel(%q) = %v, want ok=%v", c.provider, c.model, err, c.ok)
		}
	}
}

func TestCurrentReplacesOtherProvidersModels(t *testing.T) {
	saved := &domain.AISettings{AssistantModel: "claude-opus-5-5", DocumentCheckModel: "nvidia/x:free", AssistantEffort: "low", AssistantDailyLimit: 5}
	s := NewAISettingsService(&fakeAISettingsRepo{saved: saved}, domain.AISettings{}, AIProviderOpenRouter, "sk-or-env", "secret")
	if err := s.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	got := s.Current()
	if got.AssistantModel != defaultAIModel[AIProviderOpenRouter] || got.DocumentCheckModel != "nvidia/x:free" {
		t.Errorf("Current() = %+v", got)
	}
}

func TestAdminKeyOverridesEnvAndSurvivesReload(t *testing.T) {
	repo := &fakeAISettingsRepo{}
	s := NewAISettingsService(repo, domain.AISettings{}, AIProviderAnthropic, "sk-ant-env", "secret")
	sealed, err := s.sealer.seal("sk-or-admin")
	if err != nil {
		t.Fatal(err)
	}
	repo.key = &domain.AIAPIKey{Provider: AIProviderOpenRouter, Ciphertext: sealed}
	if strings.Contains(string(sealed), "sk-or-admin") {
		t.Fatal("key is stored in plaintext")
	}

	reloaded := NewAISettingsService(repo, domain.AISettings{}, AIProviderAnthropic, "sk-ant-env", "secret")
	if err := reloaded.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	if p, k := reloaded.Credentials(); p != AIProviderOpenRouter || k != "sk-or-admin" {
		t.Errorf("Credentials() = %s %q, want the admin key", p, k)
	}
	if st := reloaded.KeyStatus(); st.Source != "admin" {
		t.Errorf("KeyStatus().Source = %q", st.Source)
	}

	// A different secret can't open the stored key: fall back to env.
	other := NewAISettingsService(repo, domain.AISettings{}, AIProviderAnthropic, "sk-ant-env", "another secret")
	if err := other.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	if p, _ := other.Credentials(); p != AIProviderAnthropic {
		t.Errorf("with a wrong secret, provider = %s, want env's", p)
	}

	if _, err := reloaded.ClearAPIKey(t.Context()); err != nil {
		t.Fatal(err)
	}
	if p, k := reloaded.Credentials(); p != AIProviderAnthropic || k != "sk-ant-env" {
		t.Errorf("after clearing, Credentials() = %s %q, want env's", p, k)
	}
}

func TestKeyProvider(t *testing.T) {
	for key, want := range map[string]string{"sk-or-v1-abc": AIProviderOpenRouter, "sk-ant-api03-abc": AIProviderAnthropic, "abc": ""} {
		got, err := keyProvider(key)
		if got != want || (want == "") != (err != nil) {
			t.Errorf("keyProvider(%q) = %q, %v", key, got, err)
		}
	}
}

type fakeAISettingsRepo struct {
	saved *domain.AISettings
	key   *domain.AIAPIKey
}

func (r *fakeAISettingsRepo) Get(context.Context) (*domain.AISettings, error) {
	if r.saved == nil {
		return nil, repository.ErrNotFound
	}
	cp := *r.saved
	return &cp, nil
}
func (r *fakeAISettingsRepo) Save(context.Context, *domain.AISettings) error { return nil }
func (r *fakeAISettingsRepo) GetAPIKey(context.Context) (*domain.AIAPIKey, error) {
	if r.key == nil {
		return nil, repository.ErrNotFound
	}
	return r.key, nil
}
func (r *fakeAISettingsRepo) SaveAPIKey(_ context.Context, k *domain.AIAPIKey) error {
	r.key = k
	return nil
}
func (r *fakeAISettingsRepo) DeleteAPIKey(context.Context) error {
	r.key = nil
	return nil
}

func TestVerifyAPIKeyReasons(t *testing.T) {
	saved := openRouterBaseURL
	defer func() { openRouterBaseURL = saved }()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Header.Get("Authorization") {
		case "Bearer sk-or-good":
			w.WriteHeader(http.StatusOK)
		case "Bearer sk-or-bad":
			w.WriteHeader(http.StatusUnauthorized)
		default:
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"message":"upstream is down"}}`))
		}
	}))
	defer srv.Close()
	openRouterBaseURL = srv.URL

	if err := verifyAPIKey(t.Context(), AIProviderOpenRouter, "sk-or-good"); err != nil {
		t.Errorf("good key: %v", err)
	}
	if err := verifyAPIKey(t.Context(), AIProviderOpenRouter, "sk-or-bad"); err == nil || !strings.Contains(err.Error(), "жарамсыз") {
		t.Errorf("bad key: %v", err)
	}
	if err := verifyAPIKey(t.Context(), AIProviderOpenRouter, "sk-or-other"); err == nil || !strings.Contains(err.Error(), "HTTP 503 қайтарды: upstream is down") {
		t.Errorf("provider outage: %v", err)
	}

	openRouterBaseURL = "http://no-such-host.invalid"
	if err := verifyAPIKey(t.Context(), AIProviderOpenRouter, "sk-or-good"); err == nil || !strings.Contains(err.Error(), "DNS") {
		t.Errorf("unreachable host: %v", err)
	}
}
