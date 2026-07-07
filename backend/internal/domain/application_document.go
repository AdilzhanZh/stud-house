package domain

import (
	"time"

	"github.com/google/uuid"
)

// ApplicationDocument is a file the student attached to their application.
// Exactly one of BenefitRequiredDocumentID (a specific benefit's required
// document) or DocumentName (a free-form generic document) is set.
// This phase only stores the URL — actual file storage (S3/MinIO/disk) is
// out of scope; the frontend is assumed to upload the file elsewhere and
// pass back its URL.
type ApplicationDocument struct {
	ID                        uuid.UUID
	ApplicationID             uuid.UUID
	BenefitRequiredDocumentID *uuid.UUID
	DocumentName              *string
	FileURL                   string
	UploadedAt                time.Time
}
