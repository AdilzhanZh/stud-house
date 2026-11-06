package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"

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

func TestMessageText(t *testing.T) {
	cases := map[string]string{
		`{"role":"assistant","content":[{"type":"text","text":"Сәлем"},{"type":"text","text":"!"}]}`: "Сәлем!",
		`{"role":"assistant","content":"\n\n4"}`:                                                     "4",
		`{"role":"assistant","content":"<think>hmm</think>\nЖауап"}`:                                 "Жауап",
		// An unclosed-at-start think block (template opened it).
		`{"role":"assistant","content":"hmm…</think>Жауап"}`: "Жауап",
	}
	for in, want := range cases {
		var m llmMessage
		if err := json.Unmarshal([]byte(in), &m); err != nil {
			t.Fatal(err)
		}
		if got := m.textContent(); got != want {
			t.Errorf("textContent(%s) = %q, want %q", in, got, want)
		}
	}
}

func TestChatRetriesAndSendsSettings(t *testing.T) {
	saved := aiBaseURL
	defer func() { aiBaseURL = saved }()
	var calls atomic.Int32
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" || r.URL.Path != "/chat/completions" {
			t.Errorf("auth %q path %q", r.Header.Get("Authorization"), r.URL.Path)
		}
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":{"message":"slow down"}}`))
			return
		}
		_ = json.NewDecoder(r.Body).Decode(&got)
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"ok","reasoning_content":"thinking…"}}]}`))
	}))
	defer srv.Close()
	aiBaseURL = srv.URL

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	msg, finish, err := newLLMClient("test-key", time.Second).chat(ctx, llmRequest{
		Model: aiModel, Temperature: 0.1, ChatTemplateKwargs: thinking(false),
	})
	if err != nil || msg.textContent() != "ok" || finish != "stop" {
		t.Fatalf("chat = %v, %q, %v", msg, finish, err)
	}
	if calls.Load() != 2 {
		t.Errorf("calls = %d, want a retry after 429", calls.Load())
	}
	if got["model"] != aiModel || got["chat_template_kwargs"].(map[string]any)["enable_thinking"] != false {
		t.Errorf("request = %v", got)
	}
}

func TestChatDoesNotRetryClientErrors(t *testing.T) {
	saved := aiBaseURL
	defer func() { aiBaseURL = saved }()
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":{"message":"bad key"}}`))
	}))
	defer srv.Close()
	aiBaseURL = srv.URL
	if _, _, err := newLLMClient("x", time.Second).chat(context.Background(), llmRequest{Model: aiModel}); err == nil || calls.Load() != 1 {
		t.Errorf("err = %v, calls = %d", err, calls.Load())
	}
}

type fakeAccessRepo struct{ saved *domain.AssistantAccess }

func (r *fakeAccessRepo) Get(context.Context) (*domain.AssistantAccess, error) {
	if r.saved == nil {
		return nil, repository.ErrNotFound
	}
	return r.saved, nil
}
func (r *fakeAccessRepo) Save(_ context.Context, a *domain.AssistantAccess) error {
	now := time.Now()
	a.UpdatedAt = &now
	r.saved = a
	return nil
}

func TestAssistantAccess(t *testing.T) {
	student := &domain.User{Role: domain.RoleStudent}
	staff := &domain.User{Role: domain.RoleUser}
	manager := &domain.User{Role: domain.RoleUser, IsManager: true}
	committeeManager := &domain.User{Role: domain.RoleUser, IsManager: true, IsCommitteeMember: true}
	admin := &domain.User{Role: domain.RoleAdmin}

	noKey := NewAssistantAccessService(&fakeAccessRepo{}, "")
	if noKey.Allowed(admin) {
		t.Error("without a key nobody may use the assistant")
	}

	s := NewAssistantAccessService(&fakeAccessRepo{}, "key")
	for _, u := range []*domain.User{student, staff, manager, admin} {
		if !s.Allowed(u) {
			t.Errorf("by default everyone is allowed, %+v isn't", u)
		}
	}

	if _, err := s.Update(context.Background(), uuid.New(), []domain.AssistantAudience{domain.AudienceCommittee, domain.AudienceAdmin}); err != nil {
		t.Fatal(err)
	}
	want := map[*domain.User]bool{student: false, staff: false, manager: false, committeeManager: true, admin: true}
	for u, ok := range want {
		if s.Allowed(u) != ok {
			t.Errorf("Allowed(%+v) = %v, want %v", u, !ok, ok)
		}
	}

	if _, err := s.Update(context.Background(), uuid.New(), []domain.AssistantAudience{"guest"}); err == nil {
		t.Error("an unknown audience must be rejected")
	}
	if _, err := s.Update(context.Background(), uuid.New(), nil); err != nil || s.Allowed(admin) {
		t.Errorf("an empty list turns it off for everyone: %v", err)
	}
}
