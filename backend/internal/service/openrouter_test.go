package service

import (
	"context"
	"encoding/json"
	"slices"
	"testing"

	"student-house/internal/domain"
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
	or := &AISettingsService{provider: AIProviderOpenRouter}
	an := &AISettingsService{provider: AIProviderAnthropic}
	cases := []struct {
		s     *AISettingsService
		model string
		ok    bool
	}{
		{or, "nvidia/nemotron-3.5-super-vl:free", true},
		{or, "claude-opus-5-5", false},
		{or, "google/gemma 4", false},
		{or, "", false},
		{an, "claude-sonnet-5-5", true},
		{an, "anthropic/claude-sonnet-5-5", false},
	}
	for _, c := range cases {
		if err := c.s.validModel(c.model); (err == nil) != c.ok {
			t.Errorf("%s validModel(%q) = %v, want ok=%v", c.s.provider, c.model, err, c.ok)
		}
	}
}

func TestLoadReplacesOtherProvidersModels(t *testing.T) {
	saved := &domain.AISettings{AssistantModel: "claude-opus-5-5", DocumentCheckModel: "nvidia/x:free", AssistantEffort: "low", AssistantDailyLimit: 5}
	s := NewAISettingsService(fakeAISettingsRepo{saved}, domain.AISettings{}, AIProviderOpenRouter)
	if err := s.Load(t.Context()); err != nil {
		t.Fatal(err)
	}
	got := s.Current()
	if got.AssistantModel != defaultAIModel[AIProviderOpenRouter] || got.DocumentCheckModel != "nvidia/x:free" {
		t.Errorf("Current() = %+v", got)
	}
}

type fakeAISettingsRepo struct{ saved *domain.AISettings }

func (r fakeAISettingsRepo) Get(context.Context) (*domain.AISettings, error) {
	cp := *r.saved
	return &cp, nil
}
func (r fakeAISettingsRepo) Save(context.Context, *domain.AISettings) error { return nil }
