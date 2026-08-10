package domain

import (
	"time"

	"github.com/google/uuid"
)

// ContractLanguage is which of the two required language versions of the
// contract a ContractTemplate row holds. University dormitory contracts are
// always prepared in both Kazakh and Russian (the same legal document,
// typed out twice) — see ContractTemplateService.Get.
type ContractLanguage string

const (
	ContractLanguageKK ContractLanguage = "kk"
	ContractLanguageRU ContractLanguage = "ru"
)

func (l ContractLanguage) Valid() bool {
	switch l {
	case ContractLanguageKK, ContractLanguageRU:
		return true
	default:
		return false
	}
}

// ContractTemplate is a manager/admin-editable document used to generate a
// student's dormitory residence contract ("Шарт") in one language — there is
// exactly one row per ContractLanguage, each independently edited (same
// singleton-per-key pattern as PetitionTemplate/ProtocolTemplate, keyed by
// language instead of a fixed id). The contract is a real multi-page paper
// document, so it's edited and stored as an ordered list of per-page HTML
// fragments rather than one HTML blob — see ContractTemplateService.Get,
// which seeds it with the approved wording the first time it's requested,
// before any manager has customized it.
type ContractTemplate struct {
	Language  ContractLanguage
	Pages     []string
	UpdatedBy uuid.UUID
	UpdatedAt time.Time
}

// ContractVariable is one of the fixed set of tokens a manager can insert
// into the contract template via the editor UI, never typed by hand — so a
// mistyped token can never silently fail to substitute when a contract is
// generated.
type ContractVariable struct {
	Token string
	Label string
}

// ContractVariables is the whitelist a manager picks from in the template
// editor. Every token maps to data already tracked elsewhere in the system
// (student profile, application, room, dormitory) — extending it only
// requires adding an entry here and filling it in on the frontend's
// fillContractTemplate.
var ContractVariables = []ContractVariable{
	{Token: "{{student_full_name}}", Label: "Білім алушының аты-жөні"},
	{Token: "{{student_iin}}", Label: "ЖСН"},
	{Token: "{{student_phone}}", Label: "Телефон"},
	{Token: "{{study_group}}", Label: "Институт/оқу тобы"},
	{Token: "{{room_number}}", Label: "Бөлме нөмірі"},
	{Token: "{{dormitory_name}}", Label: "Жатақхана атауы"},
	{Token: "{{dormitory_address}}", Label: "Жатақхана мекен-жайы"},
	{Token: "{{monthly_payment}}", Label: "Айлық төлем"},
	{Token: "{{yearly_payment}}", Label: "Жылдық төлем"},
	{Token: "{{date}}", Label: "Күні"},
}
