package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type ApplicationDocumentRepository interface {
	Add(ctx context.Context, d *domain.ApplicationDocument) error
	ListByApplication(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationDocument, error)
	// ListMissingRequired returns, for each given application, every
	// required document (its dormitory's, plus those of every benefit its
	// student currently holds) that has no matching upload on it.
	ListMissingRequired(ctx context.Context, applicationIDs []uuid.UUID) ([]*domain.MissingRequiredDocument, error)

	// ClaimPendingChecks atomically moves up to limit pending documents to
	// processing (incrementing their attempt count) and returns them with
	// the context the checker needs. Safe to call from several workers.
	ClaimPendingChecks(ctx context.Context, limit int) ([]*domain.PendingDocumentCheck, error)
	// FinishCheck records the outcome of a claimed check. result is nil
	// unless status is done; errMsg is set for failed/unsupported (or a
	// retry back to pending).
	FinishCheck(ctx context.Context, documentID uuid.UUID, status domain.DocumentCheckStatus, result *domain.DocumentCheckResult, errMsg *string) error
	// RequeueStaleChecks moves processing rows claimed before cutoff back to
	// pending — a worker that crashed mid-check never finishes them.
	RequeueStaleChecks(ctx context.Context, cutoff time.Time) (int64, error)
	// ListLatestChecks returns, per application, the most recent upload for
	// each required-document slot with its check state.
	ListLatestChecks(ctx context.Context, applicationIDs []uuid.UUID) ([]*domain.DocumentCheck, error)
}
