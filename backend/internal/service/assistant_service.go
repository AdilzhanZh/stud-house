package service

import (
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/anthropics/anthropic-sdk-go/packages/param"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// assistantGuide is the user guide (Student_House_нұсқаулық.docx as plain
// text) — the assistant's knowledge of how the system works.
//
//go:embed assistant_guide.md
var assistantGuide string

const (
	// assistantMaxToolRounds caps tool-call round trips within one turn.
	assistantMaxToolRounds = 8
	// assistantMaxTurns caps one conversation's length; past it the user is
	// asked to start a new chat (history is replayed on every turn).
	assistantMaxTurns = 40
	assistantTimeout  = 3 * time.Minute
	assistantMaxInput = 2000
)

// AssistantService is the in-app chat assistant. Every role gets the user
// guide plus a set of read-only tools scoped to what that role may see; the
// assistant explains and points to the right page but never acts on the
// user's behalf.
//
// Conversations are stored append-only and replayed exactly (see the
// assistant_messages migration), and each one is pinned to the role key it
// started with, so its system prompt and tools never change mid-conversation.
type AssistantService struct {
	repo     repository.AssistantRepository
	users    repository.UserRepository
	tools    *assistantTools
	settings *AISettingsService
	client   anthropic.Client
}

// NewAssistantService: model, effort, daily limit and on/off come from
// settings on every message, so an admin's change applies immediately.
func NewAssistantService(repo repository.AssistantRepository, users repository.UserRepository, tools *assistantTools, settings *AISettingsService, apiKey string) *AssistantService {
	s := &AssistantService{repo: repo, users: users, tools: tools, settings: settings}
	if apiKey != "" {
		s.client = anthropic.NewClient(option.WithAPIKey(apiKey), option.WithRequestTimeout(assistantTimeout))
	}
	return s
}

func (s *AssistantService) Enabled() bool { return s != nil && s.settings.AssistantActive() }

// ChatMessage is one message as the chat UI shows it.
type ChatMessage struct {
	Role      string
	Text      string
	CreatedAt time.Time
}

type ChatConversation struct {
	ID       *uuid.UUID
	Messages []ChatMessage
}

// loadUser re-reads the caller so the role and positions the assistant
// works with are current, not whatever the access token was issued with.
func (s *AssistantService) loadUser(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	u, err := s.users.GetByID(ctx, userID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, apperror.Unauthorized("авторизация қажет")
	}
	return u, err
}

// Current returns the user's latest conversation, if it still matches
// their role (otherwise the next message starts a new one, so there's
// nothing to show).
func (s *AssistantService) Current(ctx context.Context, userID uuid.UUID) (*ChatConversation, error) {
	user, err := s.loadUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	conv, err := s.repo.GetLatestConversation(ctx, user.ID)
	if errors.Is(err, repository.ErrNotFound) {
		return &ChatConversation{}, nil
	}
	if err != nil {
		return nil, err
	}
	if conv.RoleKey != assistantRoleKey(user) {
		return &ChatConversation{}, nil
	}
	msgs, err := s.repo.ListMessages(ctx, conv.ID)
	if err != nil {
		return nil, err
	}
	return &ChatConversation{ID: &conv.ID, Messages: displayMessages(msgs)}, nil
}

func displayMessages(msgs []*domain.AssistantMessage) []ChatMessage {
	var out []ChatMessage
	for _, m := range msgs {
		if m.DisplayText != nil {
			out = append(out, ChatMessage{Role: m.Role, Text: *m.DisplayText, CreatedAt: m.CreatedAt})
		}
	}
	return out
}

// Send adds the user's message to a conversation (a new one when
// conversationID is nil, belongs to someone else's role, or is full), runs
// the model with tools until it answers, and returns the conversation id
// and the answer.
func (s *AssistantService) Send(ctx context.Context, userID uuid.UUID, conversationID *uuid.UUID, text, lang string) (uuid.UUID, *ChatMessage, error) {
	if !s.Enabled() {
		return uuid.Nil, nil, apperror.New(503, "assistant_disabled", "ЖИ көмекші қазір қолжетімсіз")
	}
	user, err := s.loadUser(ctx, userID)
	if err != nil {
		return uuid.Nil, nil, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return uuid.Nil, nil, apperror.BadRequest("хабарлама бос")
	}
	if len([]rune(text)) > assistantMaxInput {
		return uuid.Nil, nil, apperror.BadRequest("хабарлама тым ұзын")
	}
	if n, err := s.repo.CountUserTurnsSince(ctx, user.ID, time.Now().Add(-24*time.Hour)); err != nil {
		return uuid.Nil, nil, err
	} else if n >= s.settings.Current().AssistantDailyLimit {
		return uuid.Nil, nil, apperror.New(429, "rate_limited", "бүгінгі сұрақтар лимиті таусылды, ертең қайталап көріңіз")
	}

	roleKey := assistantRoleKey(user)
	conv, history, err := s.conversationFor(ctx, user, conversationID, roleKey)
	if err != nil {
		return uuid.Nil, nil, err
	}

	// Per-turn context goes in the user message, never the system prompt:
	// the system prompt must stay byte-identical for the whole conversation.
	userText := fmt.Sprintf("[%s · UI: %s]\n%s", time.Now().In(kyzylorda).Format(time.DateOnly), lang, text)
	userMsg := anthropic.NewBetaUserMessage(anthropic.NewBetaTextBlock(userText))
	turn := []turnMessage{{param: userMsg, role: "user", display: &text}}

	answer, err := s.runTurn(ctx, user, roleKey, history, &turn)
	if err != nil {
		return uuid.Nil, nil, err
	}

	rows := make([]*domain.AssistantMessage, 0, len(turn))
	for _, m := range turn {
		raw, err := json.Marshal(m.param)
		if err != nil {
			return uuid.Nil, nil, err
		}
		rows = append(rows, &domain.AssistantMessage{Role: m.role, Content: raw, DisplayText: m.display})
	}
	if err := s.repo.AppendMessages(ctx, conv.ID, len(history), rows); err != nil {
		if errors.Is(err, repository.ErrConflict) {
			return uuid.Nil, nil, apperror.Conflict("алдыңғы хабарламаға жауап әлі дайындалып жатыр")
		}
		return uuid.Nil, nil, err
	}
	last := rows[len(rows)-1]
	return conv.ID, &ChatMessage{Role: "assistant", Text: answer, CreatedAt: last.CreatedAt}, nil
}

type turnMessage struct {
	param   anthropic.BetaMessageParam
	role    string
	display *string
}

func (s *AssistantService) conversationFor(ctx context.Context, user *domain.User, id *uuid.UUID, roleKey string) (*domain.AssistantConversation, []anthropic.BetaMessageParam, error) {
	if id != nil {
		conv, err := s.repo.GetConversation(ctx, *id, user.ID)
		if err != nil && !errors.Is(err, repository.ErrNotFound) {
			return nil, nil, err
		}
		if err == nil && conv.RoleKey == roleKey {
			msgs, err := s.repo.ListMessages(ctx, conv.ID)
			if err != nil {
				return nil, nil, err
			}
			if countUserTurns(msgs) >= assistantMaxTurns {
				return nil, nil, apperror.BadRequest("чат тым ұзақ болды, жаңа чат бастаңыз")
			}
			history := make([]anthropic.BetaMessageParam, 0, len(msgs))
			for _, m := range msgs {
				history = append(history, param.Override[anthropic.BetaMessageParam](m.Content))
			}
			return conv, history, nil
		}
	}
	conv := &domain.AssistantConversation{UserID: user.ID, RoleKey: roleKey}
	if err := s.repo.CreateConversation(ctx, conv); err != nil {
		return nil, nil, err
	}
	return conv, nil, nil
}

func countUserTurns(msgs []*domain.AssistantMessage) int {
	n := 0
	for _, m := range msgs {
		if m.Role == "user" && m.DisplayText != nil {
			n++
		}
	}
	return n
}

// runTurn calls the model, executing tool calls, until it gives a final
// answer. Every message it produces is appended to turn; the turn is only
// persisted by the caller once it completed, so a failure leaves no
// half-finished tool exchange in the stored history.
func (s *AssistantService) runTurn(ctx context.Context, user *domain.User, roleKey string, history []anthropic.BetaMessageParam, turn *[]turnMessage) (string, error) {
	caps := assistantCapabilities(user)
	cfg := s.settings.Current()
	params := anthropic.BetaMessageNewParams{
		Model:     anthropic.Model(cfg.AssistantModel),
		MaxTokens: 16000,
		System:    []anthropic.BetaTextBlockParam{{Text: assistantSystemPrompt(caps)}},
		Tools:     s.tools.definitions(caps),
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffort(cfg.AssistantEffort),
		},
		// Caches the tools + system prompt (the whole user guide), which
		// are identical for every conversation of the same role.
		CacheControl: anthropic.NewBetaCacheControlEphemeralParam(),
		Fallbacks:    anthropic.BetaFallbacksParamOfDefault(),
		Betas:        []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
	}

	for round := 0; round < assistantMaxToolRounds; round++ {
		params.Messages = append(append([]anthropic.BetaMessageParam{}, history...), turnParams(*turn)...)
		resp, err := s.client.Beta.Messages.New(ctx, params)
		if err != nil {
			log.Printf("assistant (%s): API call failed: %v", roleKey, err)
			return "", apperror.New(502, "assistant_failed", "ЖИ көмекші жауап бере алмады, қайталап көріңіз")
		}
		if resp.StopReason == anthropic.BetaStopReasonRefusal {
			return "", apperror.BadRequest("бұл сұраққа ЖИ көмекші жауап бере алмайды")
		}
		*turn = append(*turn, turnMessage{param: resp.ToParam(), role: "assistant"})

		var results []anthropic.BetaContentBlockParamUnion
		var text strings.Builder
		for _, block := range resp.Content {
			switch b := block.AsAny().(type) {
			case anthropic.BetaTextBlock:
				text.WriteString(b.Text)
			case anthropic.BetaToolUseBlock:
				out, isErr := s.tools.run(ctx, user, caps, b.Name, b.Input)
				results = append(results, anthropic.NewBetaToolResultBlock(b.ID, out, isErr))
			}
		}
		if resp.StopReason != anthropic.BetaStopReasonToolUse || len(results) == 0 {
			answer := strings.TrimSpace(text.String())
			if answer == "" {
				answer = "…"
			}
			(*turn)[len(*turn)-1].display = &answer
			return answer, nil
		}
		*turn = append(*turn, turnMessage{param: anthropic.NewBetaUserMessage(results...), role: "user"})
	}
	return "", apperror.New(502, "assistant_failed", "ЖИ көмекші жауап бере алмады, сұрақты нақтырақ қойып көріңіз")
}

func turnParams(turn []turnMessage) []anthropic.BetaMessageParam {
	out := make([]anthropic.BetaMessageParam, 0, len(turn))
	for _, m := range turn {
		out = append(out, m.param)
	}
	return out
}
