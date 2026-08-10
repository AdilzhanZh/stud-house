package domain

import (
	"time"

	"github.com/google/uuid"
)

// PetitionTemplate is the single, manager/admin-editable document used to
// generate each student's "Өтініш" (dormitory placement petition letter).
// There is exactly one petition template system-wide, edited in place (same
// singleton pattern as ProtocolTemplate) — see PetitionTemplateService.Get,
// which seeds it with the approved wording the first time it's requested,
// before any manager has customized it. Pages is an ordered list of HTML
// fragments — almost always just one page, but a manager can add more
// through the editor if the wording grows past one sheet.
type PetitionTemplate struct {
	ID        uuid.UUID
	Pages     []string
	UpdatedBy uuid.UUID
	UpdatedAt time.Time
}

// PetitionVariable is one of the fixed set of tokens a manager can insert
// into the template via the editor UI, never typed by hand — so a mistyped
// token can never silently fail to substitute when a petition is generated.
type PetitionVariable struct {
	Token string
	Label string
}

// PetitionVariables is the whitelist a manager picks from in the template
// editor. Extending it (e.g. once the Application model grows a new field)
// only requires adding an entry here — existing saved templates keep
// working since their tokens are untouched.
var PetitionVariables = []PetitionVariable{
	{Token: "{{full_name}}", Label: "Аты-жөні"},
	{Token: "{{study_group}}", Label: "Оқу тобы"},
	{Token: "{{hometown}}", Label: "Келген жері (ауыл, аудан)"},
	{Token: "{{phone_self}}", Label: "Өз телефоны"},
	{Token: "{{parent_contact}}", Label: "Ата-ана/жақын телефоны"},
	{Token: "{{dormitory_name}}", Label: "Жатақхана атауы"},
	{Token: "{{date}}", Label: "Күні"},
}
