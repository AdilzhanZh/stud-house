package domain

import "github.com/google/uuid"

// TriageColor sorts pending applications by how much human attention they
// need, rather than by date:
//   - green: everything checks out, safe to approve in bulk;
//   - yellow: something the student can fix themselves (a missing document,
//     a preferred room that's no longer available) — can be sent back for
//     correction in bulk;
//   - red: needs a manager's judgement — the AI document check found a
//     document about someone else, or signs of tampering.
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

	// Yellow reasons from the AI document check — the student can fix them
	// by uploading a better document.
	TriageDocumentUnreadable TriageReasonCode = "document_unreadable"
	TriageWrongDocumentType  TriageReasonCode = "wrong_document_type"
	// TriageDocumentExpired: issued longer ago than its RequiredDocument.
	// ValidityDays allows; Detail is the issue date.
	TriageDocumentExpired TriageReasonCode = "document_expired"
	// TriageUnsupportedFormat: the checker can't read the file at all
	// (e.g. a .docx); Detail says why.
	TriageUnsupportedFormat TriageReasonCode = "unsupported_format"

	// Red reasons from the AI document check — need a manager's judgement.
	// TriageNameMismatch: Detail is the name found on the document.
	TriageNameMismatch TriageReasonCode = "name_mismatch"
	// TriageSuspectedForgery: Detail/DetailRu say what looked tampered.
	TriageSuspectedForgery TriageReasonCode = "suspected_forgery"
	// TriageCheckFailed: the AI check kept failing (API errors), so nobody
	// has looked at this document yet — a person has to.
	TriageCheckFailed TriageReasonCode = "check_failed"
)

// Red reports whether this reason needs a manager's judgement rather than
// a correction from the student.
func (c TriageReasonCode) Red() bool {
	return c == TriageNameMismatch || c == TriageSuspectedForgery || c == TriageCheckFailed
}

// TriageReason explains one thing that kept an application from being
// green. DocumentNameKk/Ru name the document for every document reason;
// Detail carries the specifics (the room check's message, an issue date, a
// name found on the document, a forgery reason in Kazakh — with DetailRu
// its Russian version when the model wrote both).
type TriageReason struct {
	Code           TriageReasonCode
	DocumentNameKk string
	DocumentNameRu string
	Detail         string
	DetailRu       string
}

type ApplicationTriage struct {
	ApplicationID uuid.UUID
	Color         TriageColor
	Reasons       []TriageReason
	// Checking is set while any of the application's documents is still
	// waiting on its AI check: the color may still change, so bulk
	// approval skips it.
	Checking bool
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
	// Reason is why the student has to upload this slot (again):
	// missing_document, or one of the yellow AI check reasons. Detail is
	// that reason's Detail (e.g. the issue date of an expired document).
	Reason TriageReasonCode
	Detail string
}
