package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AssistantConversation struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	RoleKey   string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// AssistantMessage is one Messages API message of a conversation. Content
// is the raw message JSON, replayed to the API byte for byte.
type AssistantMessage struct {
	ID             uuid.UUID
	ConversationID uuid.UUID
	Seq            int
	Role           string
	Content        json.RawMessage
	DisplayText    *string
	CreatedAt      time.Time
}
