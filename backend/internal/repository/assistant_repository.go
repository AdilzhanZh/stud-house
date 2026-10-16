package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type AssistantRepository interface {
	CreateConversation(ctx context.Context, c *domain.AssistantConversation) error
	// GetConversation returns the conversation only if it belongs to userID.
	GetConversation(ctx context.Context, id, userID uuid.UUID) (*domain.AssistantConversation, error)
	GetLatestConversation(ctx context.Context, userID uuid.UUID) (*domain.AssistantConversation, error)
	ListMessages(ctx context.Context, conversationID uuid.UUID) ([]*domain.AssistantMessage, error)
	// AppendMessages adds a whole turn in one transaction, numbering it after
	// the conversation's current last message. Returns ErrConflict if
	// another turn was appended concurrently (expectedNextSeq is stale).
	AppendMessages(ctx context.Context, conversationID uuid.UUID, expectedNextSeq int, msgs []*domain.AssistantMessage) error
	// CountUserTurnsSince counts the user's own chat messages (not tool
	// results) across all conversations since t — for rate limiting.
	CountUserTurnsSince(ctx context.Context, userID uuid.UUID, t time.Time) (int, error)
}
