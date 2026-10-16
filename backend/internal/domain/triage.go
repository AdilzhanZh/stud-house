package domain

import "github.com/google/uuid"

// TriageColor sorts pending applications by how much human attention they
// need, rather than by date:
//   - green: everything checks out, safe to approve in bulk;
//   - yellow: something the student can fix themselves (a missing document,
//     a preferred room that's no longer available) — can be sent back for
//     correction in bulk;
//   - red: needs a manager's judgement. Nothing produces red yet; it's
//     reserved for the AI document checks (contradictory documents,
//     suspected forgery) planned on top of this.
type TriageColor string

const (
	TriageGreen  TriageColor = "green"
	TriageYellow TriageColor = "yellow"
	TriageRed    TriageColor = "red"
)

type TriageReasonCode string

const (
	// TriageMissingDocument: a document required by the application's
	// dormitory, or by one of the student's benefits, has no upload.
	TriageMissingDocument TriageReasonCode = "missing_document"
	// TriageRoomUnavailable: the student's preferred room would fail the
	// same checks ApplicationService.Decide runs on approve (full, held to
	// capacity by other applicants, or restricted against this student).
	TriageRoomUnavailable TriageReasonCode = "room_unavailable"
)

// TriageReason explains one thing that kept an application from being
// green. DocumentNameKk/Ru are set for missing_document; Detail carries the
// underlying check's message for room_unavailable.
type TriageReason struct {
	Code           TriageReasonCode
	DocumentNameKk string
	DocumentNameRu string
	Detail         string
}

type ApplicationTriage struct {
	ApplicationID uuid.UUID
	Color         TriageColor
	Reasons       []TriageReason
}

// MissingRequiredDocument is a required document (from the application's
// dormitory or one of its student's benefits) with no matching upload.
// Exactly one of BenefitRequiredDocumentID/DormitoryRequiredDocumentID is
// set — the same id a student passes to AddDocument to fill the gap.
type MissingRequiredDocument struct {
	ApplicationID               uuid.UUID
	BenefitRequiredDocumentID   *uuid.UUID
	DormitoryRequiredDocumentID *uuid.UUID
	NameKk                      string
	NameRu                      string
}
