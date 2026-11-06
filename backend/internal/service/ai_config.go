package service

import "time"

// Everything about how the AI features run is fixed here, in code. Admins
// only choose who may use the assistant (see AssistantAccessService); the
// API key comes from the environment (ALEM_API_KEY).
//
// The provider is alem.ai's OpenAI-compatible chat completions API (vLLM
// behind LiteLLM). Its qwen3-8 model reads images, calls tools, has a
// 262k-token context and can "think" before answering; thinking is switched
// per request with chat_template_kwargs.enable_thinking.
const (
	aiModel = "qwen3-8"

	// Assistant: thinking on — it picks tools and reads their results
	// noticeably better, at a few seconds' cost. Qwen3's recommended
	// sampling for thinking mode is temperature 0.6, top_p 0.95, top_k 20.
	assistantThinking    = true
	assistantTemperature = 0.6
	assistantTopP        = 0.95
	assistantTopK        = 20
	// assistantMaxTokens bounds one reply including its thinking.
	assistantMaxTokens = 8192
	// assistantDailyLimit caps chat messages per user per 24 hours.
	assistantDailyLimit = 50

	// Document checks: thinking off, near-deterministic, and the answer is
	// constrained to the result's JSON schema by the server.
	documentCheckThinking    = false
	documentCheckTemperature = 0.1
	documentCheckMaxTokens   = 2048
	// documentCheckMaxPDFPages: a PDF is sent as images of its first pages
	// (the API reads images, not PDF files).
	documentCheckMaxPDFPages = 3
	documentCheckPDFDPI      = 130

	// aiRateLimitRetries: a 429/5xx from the provider is retried this many
	// times, aiRetryDelay apart (doubling).
	aiRateLimitRetries = 2
	aiRetryDelay       = 2 * time.Second
)

// aiBaseURL can be pointed elsewhere (e.g. a local mock in tests) with
// ALEM_BASE_URL.
var aiBaseURL = envOr("ALEM_BASE_URL", "https://llm.alem.ai/v1")

// AIModelName is shown to admins (read-only).
const AIModelName = aiModel
