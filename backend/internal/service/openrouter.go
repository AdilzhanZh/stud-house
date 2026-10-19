package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"time"
)

// openRouterBaseURL can be pointed elsewhere (e.g. a local mock in tests)
// with OPENROUTER_BASE_URL.
var openRouterBaseURL = envOr("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

const (
	// openRouterModelsTTL: how long the model list shown to admins is cached.
	openRouterModelsTTL = time.Hour
)

// openRouterClient is a minimal client for OpenRouter's OpenAI-compatible
// chat completions API — just what the assistant and document checks use.
type openRouterClient struct {
	apiKey string
	http   *http.Client
}

func newOpenRouterClient(apiKey string, timeout time.Duration) *openRouterClient {
	return &openRouterClient{apiKey: apiKey, http: &http.Client{Timeout: timeout}}
}

// orMessage is one chat message. Content is a string or a list of parts
// (text, image_url, file); it is omitted on an assistant message that only
// calls tools.
type orMessage struct {
	Role             string          `json:"role"`
	Content          any             `json:"content,omitempty"`
	ToolCalls        []orToolCall    `json:"tool_calls,omitempty"`
	ToolCallID       string          `json:"tool_call_id,omitempty"`
	ReasoningDetails json.RawMessage `json:"reasoning_details,omitempty"`
}

type orToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type orTool struct {
	Type     string         `json:"type"`
	Function orToolFunction `json:"function"`
}

type orToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type orRequest struct {
	Model          string            `json:"model"`
	Messages       []json.RawMessage `json:"messages"`
	Tools          []orTool          `json:"tools,omitempty"`
	Reasoning      *orReasoning      `json:"reasoning,omitempty"`
	ResponseFormat map[string]any    `json:"response_format,omitempty"`
	Plugins        []map[string]any  `json:"plugins,omitempty"`
}

type orReasoning struct {
	Effort string `json:"effort"`
}

type orResponse struct {
	Choices []struct {
		FinishReason string    `json:"finish_reason"`
		Message      orMessage `json:"message"`
	} `json:"choices"`
	Error *orError `json:"error"`
}

type orError struct {
	Code    any    `json:"code"`
	Message string `json:"message"`
}

// openRouterError is a failed API call; Status is the HTTP status (429
// when a free model's rate limit is used up).
type openRouterError struct {
	Status  int
	Message string
}

func (e *openRouterError) Error() string {
	return fmt.Sprintf("openrouter: %d %s", e.Status, e.Message)
}

func isOpenRouterRateLimit(err error) bool {
	var oe *openRouterError
	return errors.As(err, &oe) && oe.Status == http.StatusTooManyRequests
}

// chat sends one chat completion request and returns the first choice.
func (c *openRouterClient) chat(ctx context.Context, req orRequest) (*orMessage, string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, openRouterBaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-Title", "Student House")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	var out orResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		if resp.StatusCode != http.StatusOK {
			return nil, "", &openRouterError{Status: resp.StatusCode, Message: strings.TrimSpace(string(raw))}
		}
		return nil, "", fmt.Errorf("openrouter: decoding response: %w", err)
	}
	if out.Error != nil || resp.StatusCode != http.StatusOK {
		status, msg := resp.StatusCode, resp.Status
		if out.Error != nil {
			msg = out.Error.Message
			// Errors from the upstream model provider can come back with
			// a 200 and the real status as the error code.
			if code, ok := out.Error.Code.(float64); ok && status == http.StatusOK {
				status = int(code)
			}
		}
		return nil, "", &openRouterError{Status: status, Message: msg}
	}
	if len(out.Choices) == 0 {
		return nil, "", errors.New("openrouter: empty response")
	}
	return &out.Choices[0].Message, out.Choices[0].FinishReason, nil
}

// textContent returns a message's text, whether content is a string or a
// list of parts.
func (m *orMessage) textContent() string {
	switch c := m.Content.(type) {
	case string:
		return c
	case []any:
		var b strings.Builder
		for _, p := range c {
			if part, ok := p.(map[string]any); ok && part["type"] == "text" {
				if t, ok := part["text"].(string); ok {
					b.WriteString(t)
				}
			}
		}
		return b.String()
	}
	return ""
}

// openRouterModels caches the ids of OpenRouter's free models, offered to
// admins as suggestions — any model id can still be typed in.
type openRouterModels struct {
	mu      sync.Mutex
	ids     []string
	fetched time.Time
}

var freeOpenRouterModels openRouterModels

func (m *openRouterModels) list(ctx context.Context) []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	if time.Since(m.fetched) < openRouterModelsTTL {
		return m.ids
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, openRouterBaseURL+"/models", nil)
	if err != nil {
		return m.ids
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return m.ids
	}
	defer resp.Body.Close()
	var out struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&out) != nil {
		return m.ids
	}
	ids := []string{}
	for _, d := range out.Data {
		if strings.HasSuffix(d.ID, ":free") {
			ids = append(ids, d.ID)
		}
	}
	slices.Sort(ids)
	m.ids, m.fetched = ids, time.Now()
	return ids
}

// extractJSONObject returns the outermost {...} in a model's text answer,
// which may wrap the JSON in a code fence or a sentence.
func extractJSONObject(s string) string {
	start, end := strings.Index(s, "{"), strings.LastIndex(s, "}")
	if start < 0 || end < start {
		return s
	}
	return s[start : end+1]
}
