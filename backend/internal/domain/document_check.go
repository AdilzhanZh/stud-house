package domain

import (
	"time"

	"github.com/google/uuid"
)

// DocumentCheckStatus tracks the AI check of one uploaded document.
type DocumentCheckStatus string

const (
	// DocumentCheckSkipped: never checked — not a required-document upload,
	// AI checks are disabled, or it predates them.
	DocumentCheckSkipped     DocumentCheckStatus = "skipped"
	DocumentCheckPending     DocumentCheckStatus = "pending"
	DocumentCheckProcessing  DocumentCheckStatus = "processing"
	DocumentCheckDone        DocumentCheckStatus = "done"
	DocumentCheckFailed      DocumentCheckStatus = "failed"
	DocumentCheckUnsupported DocumentCheckStatus = "unsupported"
)

// InProgress reports whether a result is still to come.
func (s DocumentCheckStatus) InProgress() bool {
	return s == DocumentCheckPending || s == DocumentCheckProcessing
}

// NameMatch is whether a document is about the applying student.
type NameMatch string

const (
	NameMatchYes NameMatch = "yes"
	NameMatchNo  NameMatch = "no"
	// NameMatchNotApplicable: the document is legitimately about someone
	// else (e.g. a parent's certificate for a family benefit) or names no
	// person at all.
	NameMatchNotApplicable NameMatch = "not_applicable"
	NameMatchUnclear       NameMatch = "unclear"
)

// DocumentCheckResult is what the model extracts from one document. It is
// both the structured-output schema sent to the API and the JSON stored in
// application_documents.ai_result — field tags drive both.
type DocumentCheckResult struct {
	Readable            bool      `json:"readable" jsonschema_description:"False if the file is blank, too blurry, cropped or otherwise impossible to read reliably."`
	DetectedType        string    `json:"detected_type" jsonschema_description:"What the document actually is, in a few words of Russian, e.g. 'справка о составе семьи'."`
	MatchesExpectedType bool      `json:"matches_expected_type" jsonschema_description:"True if this document is (or plausibly serves as) the expected document. Accept equivalent official names and Kazakh/Russian variants."`
	HolderFullName      string    `json:"holder_full_name" jsonschema_description:"Full name of the person the document is issued to or about, as written. Empty string if none."`
	NamesStudent        NameMatch `json:"names_student" jsonschema:"enum=yes,enum=no,enum=not_applicable,enum=unclear" jsonschema_description:"Whether the document is about the applying student. Treat transliteration, word order and patronymic differences as the same person. not_applicable if it is legitimately about a relative (e.g. a parent's certificate) or names nobody."`
	IssueDate           string    `json:"issue_date" jsonschema_description:"Issue date as YYYY-MM-DD, or empty string if no issue date is visible."`
	ForgerySigns        bool      `json:"forgery_signs" jsonschema_description:"True only for concrete signs of tampering: edited text with mismatched fonts or alignment, pasted elements, inconsistent dates or numbers within the document. Not for low image quality alone."`
	ForgeryReasonKk     string    `json:"forgery_reason_kk" jsonschema_description:"If forgery_signs, a short concrete reason in Kazakh; otherwise empty."`
	ForgeryReasonRu     string    `json:"forgery_reason_ru" jsonschema_description:"Same reason in Russian; otherwise empty."`
	SummaryKk           string    `json:"summary_kk" jsonschema_description:"One-sentence summary of the document for a dormitory manager, in Kazakh."`
	SummaryRu           string    `json:"summary_ru" jsonschema_description:"Same summary in Russian."`
}

// IssuedOn parses IssueDate, or returns nil if absent or malformed.
func (r *DocumentCheckResult) IssuedOn() *time.Time {
	if r == nil || r.IssueDate == "" {
		return nil
	}
	t, err := time.Parse(time.DateOnly, r.IssueDate)
	if err != nil {
		return nil
	}
	return &t
}

// PendingDocumentCheck is a claimed document waiting to be checked, with
// what the model needs to judge it.
type PendingDocumentCheck struct {
	DocumentID      uuid.UUID
	FileURL         string
	Attempts        int
	ExpectedNameKk  string
	ExpectedNameRu  string
	StudentFullName string
}

// DocumentCheck is the latest upload for one required-document slot of an
// application, with its check state — what TriageService judges.
type DocumentCheck struct {
	ApplicationID               uuid.UUID
	DocumentID                  uuid.UUID
	BenefitRequiredDocumentID   *uuid.UUID
	DormitoryRequiredDocumentID *uuid.UUID
	NameKk                      string
	NameRu                      string
	ValidityDays                *int
	Status                      DocumentCheckStatus
	Result                      *DocumentCheckResult
	Error                       string
}
