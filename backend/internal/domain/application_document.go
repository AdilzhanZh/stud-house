package domain

import (
	"time"

	"github.com/google/uuid"
)

// ApplicationDocument is a file the student attached to their application.
// Exactly one of BenefitRequiredDocumentID (a specific benefit's required
// document), DormitoryRequiredDocumentID (a specific dormitory's required
// document), or DocumentName (a free-form generic document) is set.
// This phase only stores the URL — actual file storage (S3/MinIO/disk) is
// out of scope; the frontend is assumed to upload the file elsewhere and
// pass back its URL.
type ApplicationDocument struct {
	ID                          uuid.UUID
	ApplicationID               uuid.UUID
	BenefitRequiredDocumentID   *uuid.UUID
	DormitoryRequiredDocumentID *uuid.UUID
	DocumentName                *string
	FileURL                     string
	UploadedAt                  time.Time
	// DisplayName is always resolvable to a readable label — DocumentName for
	// a free-form upload, or the linked benefit's/dormitory's required
	// document name otherwise. Populated by ListByApplication's join; empty
	// on the object returned by Add (never displayed directly).
	DisplayName string
}
