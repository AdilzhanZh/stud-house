package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// ErrApplicationNotApproved is returned when a protocol is prepared with an
// application whose status isn't 'approved'.
var ErrApplicationNotApproved = errors.New("application is not approved")

// ErrResidentNotEligible is returned when a protocol is prepared with a
// student who isn't a current resident awaiting a protocol.
var ErrResidentNotEligible = errors.New("student is not a resident eligible for a protocol")

// ProtocolTx exposes the writes that must happen atomically together with
// the row lock acquired by ProtocolRepository.WithVoteLock.
type ProtocolTx interface {
	GetVote(ctx context.Context, protocolID, committeeMemberID uuid.UUID) (*domain.CommitteeVote, error)
	SetVote(ctx context.Context, protocolID, committeeMemberID uuid.UUID, decision domain.VoteDecision, reason *string) error
	ListVotes(ctx context.Context, protocolID uuid.UUID) ([]*domain.CommitteeVote, error)
	SetProtocolStatus(ctx context.Context, protocolID uuid.UUID, status domain.ProtocolStatus) error
}

type ProtocolRepository interface {
	// CreateWithStudents locks and validates applicationIDs (must all be
	// approved and not already attached to any protocol, regardless of that
	// protocol's status) and residentStudentIDs (must all be listed by
	// ListCandidates as residents), then atomically creates the protocol, its
	// protocol_applications and protocol_residents rows, and one NULL-decision
	// committee_votes row per committeeMemberIDs. Returns ErrNotFound if an
	// application id doesn't exist, ErrApplicationNotApproved,
	// ErrResidentNotEligible, or ErrConflict if one is already protocolled.
	CreateWithStudents(ctx context.Context, protocol *domain.Protocol, applicationIDs, residentStudentIDs, committeeMemberIDs []uuid.UUID) error

	GetByID(ctx context.Context, id uuid.UUID) (*domain.Protocol, error)
	// GetByApplicationID returns the protocol containing applicationID, if
	// any — an approved application isn't necessarily attached to one yet.
	// Returns ErrNotFound if none.
	GetByApplicationID(ctx context.Context, applicationID uuid.UUID) (*domain.Protocol, error)
	List(ctx context.Context, status *domain.ProtocolStatus) ([]*domain.Protocol, error)
	ListApplicationIDs(ctx context.Context, protocolID uuid.UUID) ([]uuid.UUID, error)
	ListResidents(ctx context.Context, protocolID uuid.UUID) ([]*domain.ProtocolResident, error)
	ListVotes(ctx context.Context, protocolID uuid.UUID) ([]*domain.CommitteeVote, error)

	// ListCandidates returns the manager's "prepare protocol" candidate list:
	// approved applications not yet attached to any protocol, plus current
	// residents who have never been in one. A resident who also has an
	// approved application appears only through that application.
	ListCandidates(ctx context.Context) ([]*domain.ProtocolCandidate, error)

	// WithVoteLock locks the protocol row (SELECT ... FOR UPDATE) for the
	// duration of fn, so a vote submission and the resulting tally check are
	// atomic against concurrent votes on the same protocol.
	WithVoteLock(ctx context.Context, protocolID uuid.UUID, fn func(ctx context.Context, protocol *domain.Protocol, tx ProtocolTx) error) error

	// Delete removes the protocol row (protocol_applications/committee_votes
	// cascade). Returns ErrNotFound if it doesn't exist.
	Delete(ctx context.Context, id uuid.UUID) error
	// DeleteOlderThan removes protocols created before cutoff
	// (protocol_applications/committee_votes cascade). Used by
	// RetentionService, and run before ContractRepository.DeleteOlderThan /
	// ApplicationRepository.DeleteOlderThan so their FK references clear
	// first. Returns the number of rows deleted.
	DeleteOlderThan(ctx context.Context, cutoff time.Time) (int64, error)
}
