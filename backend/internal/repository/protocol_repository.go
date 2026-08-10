package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// ErrApplicationNotApproved is returned when a protocol is prepared with an
// application whose status isn't 'approved'.
var ErrApplicationNotApproved = errors.New("application is not approved")

// ProtocolTx exposes the writes that must happen atomically together with
// the row lock acquired by ProtocolRepository.WithVoteLock.
type ProtocolTx interface {
	GetVote(ctx context.Context, protocolID, committeeMemberID uuid.UUID) (*domain.CommitteeVote, error)
	SetVote(ctx context.Context, protocolID, committeeMemberID uuid.UUID, decision domain.VoteDecision, reason *string) error
	ListVotes(ctx context.Context, protocolID uuid.UUID) ([]*domain.CommitteeVote, error)
	SetProtocolStatus(ctx context.Context, protocolID uuid.UUID, status domain.ProtocolStatus) error
}

type ProtocolRepository interface {
	// CreateWithApplications locks and validates applicationIDs (must all be
	// approved and not already attached to any protocol, regardless of that
	// protocol's status), then atomically creates the protocol, its
	// protocol_applications rows, and one NULL-decision committee_votes row
	// per committeeMemberIDs. Returns ErrNotFound if an id doesn't exist,
	// ErrApplicationNotApproved, or ErrConflict if one is already protocolled.
	CreateWithApplications(ctx context.Context, protocol *domain.Protocol, applicationIDs []uuid.UUID, committeeMemberIDs []uuid.UUID) error

	GetByID(ctx context.Context, id uuid.UUID) (*domain.Protocol, error)
	List(ctx context.Context, status *domain.ProtocolStatus) ([]*domain.Protocol, error)
	ListApplicationIDs(ctx context.Context, protocolID uuid.UUID) ([]uuid.UUID, error)
	ListVotes(ctx context.Context, protocolID uuid.UUID) ([]*domain.CommitteeVote, error)

	// EligibleApplicationIDs returns approved application ids not yet
	// attached to any protocol — the manager's "prepare protocol" candidate
	// list.
	EligibleApplicationIDs(ctx context.Context) ([]uuid.UUID, error)

	// WithVoteLock locks the protocol row (SELECT ... FOR UPDATE) for the
	// duration of fn, so a vote submission and the resulting tally check are
	// atomic against concurrent votes on the same protocol.
	WithVoteLock(ctx context.Context, protocolID uuid.UUID, fn func(ctx context.Context, protocol *domain.Protocol, tx ProtocolTx) error) error

	// Delete removes the protocol row (protocol_applications/committee_votes
	// cascade). Returns ErrNotFound if it doesn't exist.
	Delete(ctx context.Context, id uuid.UUID) error
}
