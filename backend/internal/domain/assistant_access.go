package domain

import (
	"time"

	"github.com/google/uuid"
)

// AssistantAudience is a group of users the admin can open the AI
// assistant to. A user may belong to several (a staff member who is a
// manager and a commission member); they get the assistant when any of
// their groups is allowed.
type AssistantAudience string

const (
	AudienceStudent   AssistantAudience = "student"
	AudienceStaff     AssistantAudience = "staff"
	AudienceManager   AssistantAudience = "manager"
	AudienceCommittee AssistantAudience = "committee"
	AudienceAdmin     AssistantAudience = "admin"
)

// AssistantAudiences lists every audience, in the order the admin sees them.
var AssistantAudiences = []AssistantAudience{AudienceStudent, AudienceStaff, AudienceManager, AudienceCommittee, AudienceAdmin}

// AssistantAccess is who may use the AI assistant — the only AI setting an
// admin can change; everything else is fixed in code.
type AssistantAccess struct {
	Audiences []AssistantAudience
	// UpdatedBy/UpdatedAt are nil until an admin first saves.
	UpdatedBy *uuid.UUID
	UpdatedAt *time.Time
}
