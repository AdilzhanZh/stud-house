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
// user's behalf. Model and limits are fixed in ai_config.go; admins only
// choose which roles may use it (AssistantAccessService).
//
// Conversations are stored append-only and replayed exactly (see the
// assistant_messages migration), and each one is pinned to the role key it
// started with, so its system prompt and tools never change mid-conversation.
type AssistantService struct {
	repo   repository.AssistantRepository
	users  repository.UserRepository
	tools  *assistantTools
	access *AssistantAccessService
}

func NewAssistantService(repo repository.AssistantRepository, users repository.UserRepository, tools *assistantTools, access *AssistantAccessService) *AssistantService {
	return &AssistantService{repo: repo, users: users, tools: tools, access: access}
}

// roleKey is assistantRoleKey, prefixed with the provider: conversations
// stored in another provider's message format (older Anthropic/OpenRouter
// chats) are never replayed to this one.
func roleKey(user *domain.User) string {
	return "alem:" + assistantRoleKey(user)
}

// ChatMessage is one message as the chat UI shows it.
type ChatMessage struct {
	Role      string
	Text      string
	CreatedAt time.Time
}

type ChatConversation struct {
	// Enabled: this user may use the assistant now.
	Enabled  bool
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
	if !s.access.Allowed(user) {
		return &ChatConversation{}, nil
	}
	conv, err := s.repo.GetLatestConversation(ctx, user.ID)
	if errors.Is(err, repository.ErrNotFound) {
		return &ChatConversation{Enabled: true}, nil
	}
	if err != nil {
		return nil, err
	}
	if conv.RoleKey != roleKey(user) {
		return &ChatConversation{Enabled: true}, nil
	}
	msgs, err := s.repo.ListMessages(ctx, conv.ID)
	if err != nil {
		return nil, err
	}
	return &ChatConversation{Enabled: true, ID: &conv.ID, Messages: displayMessages(msgs)}, nil
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
	user, err := s.loadUser(ctx, userID)
	if err != nil {
		return uuid.Nil, nil, err
	}
	if !s.access.APIKeyPresent() {
		return uuid.Nil, nil, apperror.New(503, "assistant_disabled", "ЖИ көмекші қазір қолжетімсіз")
	}
	if !s.access.Allowed(user) {
		return uuid.Nil, nil, apperror.Forbidden("ЖИ көмекші сіздің рөліңіз үшін қосылмаған")
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
	} else if n >= assistantDailyLimit {
		return uuid.Nil, nil, apperror.New(429, "rate_limited", "бүгінгі сұрақтар лимиті таусылды, ертең қайталап көріңіз")
	}

	key := roleKey(user)
	conv, history, err := s.conversationFor(ctx, user, conversationID, key)
	if err != nil {
		return uuid.Nil, nil, err
	}

	// Per-turn context goes in the user message, never the system prompt:
	// the system prompt must stay byte-identical for the whole conversation.
	userText := fmt.Sprintf("[%s · UI: %s]\n%s", time.Now().In(kyzylorda).Format(time.DateOnly), lang, text)
	var turn []turnMessage
	var answer string
	var drafts []formDraft
	ctx = withFormDrafts(ctx, &drafts)
	answer, err = s.runTurn(ctx, newLLMClient(s.access.APIKey(), assistantTimeout), user, key, history, userText, &turn)
	if err != nil {
		return uuid.Nil, nil, err
	}
	turn[0].display = &text
	// Form drafts become buttons under the reply (see formDraft). They're
	// added to the displayed text only — never to what's replayed to the
	// model — so the model's own history stays exactly as it produced it.
	if len(drafts) > 0 {
		answer = appendDraftButtons(answer, drafts, lang)
		turn[len(turn)-1].display = &answer
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

// turnMessage is one message produced in a turn (an llmMessage), stored as
// JSON. role is the stored row's role — tool results (role "tool") are
// stored as "user" rows.
type turnMessage struct {
	param   any
	role    string
	display *string
}

// conversationFor returns the conversation and its stored messages, raw.
func (s *AssistantService) conversationFor(ctx context.Context, user *domain.User, id *uuid.UUID, roleKey string) (*domain.AssistantConversation, []json.RawMessage, error) {
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
			history := make([]json.RawMessage, 0, len(msgs))
			for _, m := range msgs {
				history = append(history, json.RawMessage(m.Content))
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
// half-finished tool exchange in the stored history. The system prompt is
// sent as the first message on every call (not stored).
func (s *AssistantService) runTurn(ctx context.Context, llm *llmClient, user *domain.User, roleKey string, history []json.RawMessage, userText string, turn *[]turnMessage) (string, error) {
	caps := assistantCapabilities(user)
	system, err := json.Marshal(llmMessage{Role: "system", Content: assistantSystemPrompt(caps)})
	if err != nil {
		return "", err
	}
	req := llmRequest{
		Model:              aiModel,
		Tools:              s.tools.llmDefinitions(caps),
		Temperature:        assistantTemperature,
		TopP:               assistantTopP,
		TopK:               assistantTopK,
		MaxTokens:          assistantMaxTokens,
		ChatTemplateKwargs: thinking(assistantThinking),
	}
	*turn = append(*turn, turnMessage{param: llmMessage{Role: "user", Content: userText}, role: "user"})

	for round := 0; round < assistantMaxToolRounds; round++ {
		req.Messages = append([]json.RawMessage{system}, history...)
		for _, m := range *turn {
			raw, err := json.Marshal(m.param)
			if err != nil {
				return "", err
			}
			req.Messages = append(req.Messages, raw)
		}
		msg, finish, err := llm.chat(ctx, req)
		if err != nil {
			log.Printf("assistant (%s): API call failed: %v", roleKey, err)
			if isLLMRateLimit(err) {
				return "", apperror.New(429, "rate_limited", "ЖИ модельіне сұраныс көп, сәлден кейін қайталап көріңіз")
			}
			return "", apperror.New(502, "assistant_failed", "ЖИ көмекші жауап бере алмады, қайталап көріңіз")
		}
		// Only the answer and tool calls are replayed — never the thinking.
		text := msg.textContent()
		reply := llmMessage{Role: "assistant", ToolCalls: msg.ToolCalls}
		if text != "" {
			reply.Content = text
		}
		*turn = append(*turn, turnMessage{param: reply, role: "assistant"})

		if len(msg.ToolCalls) == 0 {
			if text == "" {
				log.Printf("assistant (%s): empty answer (finish_reason %q)", roleKey, finish)
				return "", apperror.New(502, "assistant_failed", "ЖИ көмекші жауап бере алмады, сұрақты нақтырақ қойып көріңіз")
			}
			(*turn)[len(*turn)-1].display = &text
			return text, nil
		}
		for _, call := range msg.ToolCalls {
			args := call.Function.Arguments
			if strings.TrimSpace(args) == "" {
				args = "{}"
			}
			out, isErr := s.tools.run(ctx, user, caps, call.Function.Name, json.RawMessage(args))
			if isErr {
				out = "Error: " + out
			}
			*turn = append(*turn, turnMessage{param: llmMessage{Role: "tool", ToolCallID: call.ID, Content: out}, role: "user"})
		}
	}
	return "", apperror.New(502, "assistant_failed", "ЖИ көмекші жауап бере алмады, сұрақты нақтырақ қойып көріңіз")
}

var draftButtonLabels = map[string]map[string]string{
	"kk": {"move_out": "Шығу сұранысын ашу", "room_transfer": "Ауыстыру сұранысын ашу", "notification": "Хабарландыруды ашу"},
	"ru": {"move_out": "Открыть заявку на выселение", "room_transfer": "Открыть заявку на перевод", "notification": "Открыть уведомление"},
	"en": {"move_out": "Open the move-out request", "room_transfer": "Open the transfer request", "notification": "Open the notification"},
}

// appendDraftButtons adds one Markdown link per draft on its own line; the
// chat UI renders a line holding nothing but an in-app link as a button.
func appendDraftButtons(answer string, drafts []formDraft, lang string) string {
	labels, ok := draftButtonLabels[lang]
	if !ok {
		labels = draftButtonLabels["kk"]
	}
	var b strings.Builder
	b.WriteString(strings.TrimSpace(answer))
	for _, d := range drafts {
		fmt.Fprintf(&b, "\n\n[%s](%s)", labels[d.Kind], d.Link)
	}
	return b.String()
}
