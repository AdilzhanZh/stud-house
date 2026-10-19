package domain

import (
	"time"

	"github.com/google/uuid"
)

// AISettings controls the AI features at runtime (see AISettingsService).
type AISettings struct {
	AssistantEnabled      bool
	AssistantModel        string
	AssistantEffort       string
	AssistantDailyLimit   int
	DocumentChecksEnabled bool
	DocumentCheckModel    string
	// UpdatedBy/UpdatedAt are nil while the env defaults are in effect.
	UpdatedBy *uuid.UUID
	UpdatedAt *time.Time
}

// AIAPIKey is an admin-set provider API key as stored: encrypted.
type AIAPIKey struct {
	Provider   string
	Ciphertext []byte
	SetBy      *uuid.UUID
	SetAt      time.Time
}
