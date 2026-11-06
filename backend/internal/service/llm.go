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
	"regexp"
	"strings"
	"time"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// llmClient is a minimal client for an OpenAI-compatible chat completions
// API (alem.ai, see ai_config.go) — just what the assistant and document
// checks use.
type llmClient struct {
	apiKey string
	http   *http.Client
}

func newLLMClient(apiKey string, timeout time.Duration) *llmClient {
	return &llmClient{apiKey: apiKey, http: &http.Client{Timeout: timeout}}
}

// llmMessage is one chat message. Content is a string or a list of parts
// (text, image_url); it is omitted on an assistant message that only calls
// tools. The model's reasoning (reasoning_content) is read but never sent
// back: Qwen3 expects history without its earlier thinking.
type llmMessage struct {
	Role             string        `json:"role"`
	Content          any           `json:"content,omitempty"`
	ToolCalls        []llmToolCall `json:"tool_calls,omitempty"`
	ToolCallID       string        `json:"tool_call_id,omitempty"`
	ReasoningContent string        `json:"reasoning_content,omitempty"`
}

type llmToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type llmTool struct {
	Type     string          `json:"type"`
	Function llmToolFunction `json:"function"`
}

type llmToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

type llmRequest struct {
	Model              string            `json:"model"`
	Messages           []json.RawMessage `json:"messages"`
	Tools              []llmTool         `json:"tools,omitempty"`
	Temperature        float64           `json:"temperature"`
	TopP               float64           `json:"top_p,omitempty"`
	TopK               int               `json:"top_k,omitempty"`
	MaxTokens          int               `json:"max_tokens,omitempty"`
	ResponseFormat     map[string]any    `json:"response_format,omitempty"`
	ChatTemplateKwargs map[string]any    `json:"chat_template_kwargs,omitempty"`
}

func thinking(on bool) map[string]any {
	return map[string]any{"enable_thinking": on}
}

type llmResponse struct {
	Choices []struct {
		FinishReason string     `json:"finish_reason"`
		Message      llmMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// llmError is a failed API call with its HTTP status.
type llmError struct {
	Status  int
	Message string
}

func (e *llmError) Error() string {
	msg := e.Message
	if len(msg) > 500 {
		msg = msg[:500] + "…"
	}
	return fmt.Sprintf("llm: HTTP %d %s", e.Status, msg)
}

func isLLMRateLimit(err error) bool {
	var le *llmError
	return errors.As(err, &le) && le.Status == http.StatusTooManyRequests
}

// retryable: rate limits and server-side failures, which usually pass.
func retryable(err error) bool {
	var le *llmError
	return errors.As(err, &le) && (le.Status == http.StatusTooManyRequests || le.Status >= 500)
}

// chat sends one chat completion request, retrying rate limits and server
// errors, and returns the first choice.
func (c *llmClient) chat(ctx context.Context, req llmRequest) (*llmMessage, string, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, "", err
	}
	delay := aiRetryDelay
	for attempt := 0; ; attempt++ {
		msg, finish, err := c.once(ctx, body)
		if err == nil || attempt >= aiRateLimitRetries || !retryable(err) {
			return msg, finish, err
		}
		select {
		case <-ctx.Done():
			return nil, "", err
		case <-time.After(delay):
		}
		delay *= 2
	}
}

func (c *llmClient) once(ctx context.Context, body []byte) (*llmMessage, string, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, aiBaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	var out llmResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		if resp.StatusCode != http.StatusOK {
			return nil, "", &llmError{Status: resp.StatusCode, Message: strings.TrimSpace(string(raw))}
		}
		return nil, "", fmt.Errorf("llm: decoding response: %w", err)
	}
	if out.Error != nil || resp.StatusCode != http.StatusOK {
		msg := resp.Status
		if out.Error != nil {
			msg = out.Error.Message
		}
		return nil, "", &llmError{Status: resp.StatusCode, Message: msg}
	}
	if len(out.Choices) == 0 {
		return nil, "", errors.New("llm: empty response")
	}
	return &out.Choices[0].Message, out.Choices[0].FinishReason, nil
}

var thinkBlock = regexp.MustCompile(`(?s)<think>.*?</think>`)

// textContent returns a message's text, whether content is a string or a
// list of parts, without any inline <think> block a model may leave in it.
func (m *llmMessage) textContent() string {
	var s string
	switch c := m.Content.(type) {
	case string:
		s = c
	case []any:
		var b strings.Builder
		for _, p := range c {
			if part, ok := p.(map[string]any); ok && part["type"] == "text" {
				if t, ok := part["text"].(string); ok {
					b.WriteString(t)
				}
			}
		}
		s = b.String()
	}
	s = thinkBlock.ReplaceAllString(s, "")
	if i := strings.Index(s, "</think>"); i >= 0 {
		s = s[i+len("</think>"):]
	}
	return strings.TrimSpace(s)
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
