package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

const protocolColumns = `id, number, status, created_by, created_at, updated_at`

type ProtocolRepo struct {
	db *pgxpool.Pool
}

func NewProtocolRepo(db *pgxpool.Pool) *ProtocolRepo {
	return &ProtocolRepo{db: db}
}

func (r *ProtocolRepo) CreateWithApplications(ctx context.Context, protocol *domain.Protocol, applicationIDs []uuid.UUID, committeeMemberIDs []uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAndValidateApprovedApplications(ctx, tx, applicationIDs); err != nil {
		return err
	}
	if err := insertProtocol(ctx, tx, protocol); err != nil {
		return err
	}
	if err := insertProtocolApplications(ctx, tx, protocol.ID, applicationIDs); err != nil {
		return err
	}
	if err := insertCommitteeVotes(ctx, tx, protocol.ID, committeeMemberIDs); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// lockAndValidateApprovedApplications locks the given application rows and
// ensures each exists, is status='approved', and isn't already attached to
// any protocol (regardless of that protocol's status — unlike the old
// report system, a protocol here is never "revised"; a stuck pending
// protocol must be deleted by the manager to free its students up again).
func lockAndValidateApprovedApplications(ctx context.Context, tx pgx.Tx, applicationIDs []uuid.UUID) error {
	rows, err := tx.Query(ctx, `SELECT id, status FROM applications WHERE id = ANY($1) FOR UPDATE`, applicationIDs)
	if err != nil {
		return err
	}
	statusByID := make(map[uuid.UUID]string, len(applicationIDs))
	for rows.Next() {
		var id uuid.UUID
		var status string
		if err := rows.Scan(&id, &status); err != nil {
			rows.Close()
			return err
		}
		statusByID[id] = status
	}
	if err := rows.Err(); err != nil {
		return err
	}
	rows.Close()

	for _, id := range applicationIDs {
		status, ok := statusByID[id]
		if !ok {
			return repository.ErrNotFound
		}
		if status != string(domain.ApplicationApproved) {
			return repository.ErrApplicationNotApproved
		}
	}

	var conflictCount int
	const conflictQ = `SELECT COUNT(*) FROM protocol_applications WHERE application_id = ANY($1)`
	if err := tx.QueryRow(ctx, conflictQ, applicationIDs).Scan(&conflictCount); err != nil {
		return err
	}
	if conflictCount > 0 {
		return repository.ErrConflict
	}

	return nil
}

func insertProtocol(ctx context.Context, tx pgx.Tx, protocol *domain.Protocol) error {
	const q = `
		INSERT INTO protocols (created_by, status)
		VALUES ($1, $2)
		RETURNING id, number, created_at, updated_at`
	return tx.QueryRow(ctx, q, protocol.CreatedBy, string(protocol.Status)).
		Scan(&protocol.ID, &protocol.Number, &protocol.CreatedAt, &protocol.UpdatedAt)
}

func insertProtocolApplications(ctx context.Context, tx pgx.Tx, protocolID uuid.UUID, applicationIDs []uuid.UUID) error {
	for _, appID := range applicationIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO protocol_applications (protocol_id, application_id) VALUES ($1, $2)`, protocolID, appID); err != nil {
			return err
		}
	}
	return nil
}

// insertCommitteeVotes seeds one NULL-decision row per committee member —
// each must cast a real vote (see ProtocolService.Vote) before the protocol
// can resolve to approved.
func insertCommitteeVotes(ctx context.Context, tx pgx.Tx, protocolID uuid.UUID, committeeMemberIDs []uuid.UUID) error {
	for _, memberID := range committeeMemberIDs {
		const q = `INSERT INTO committee_votes (protocol_id, committee_member_id, decision, reason, voted_at) VALUES ($1, $2, NULL, NULL, NULL)`
		if _, err := tx.Exec(ctx, q, protocolID, memberID); err != nil {
			return err
		}
	}
	return nil
}

func (r *ProtocolRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Protocol, error) {
	row := r.db.QueryRow(ctx, `SELECT `+protocolColumns+` FROM protocols WHERE id = $1`, id)
	return scanProtocolRow(row)
}

func (r *ProtocolRepo) List(ctx context.Context, status *domain.ProtocolStatus) ([]*domain.Protocol, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+protocolColumns+` FROM protocols WHERE status = $1 ORDER BY created_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+protocolColumns+` FROM protocols ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Protocol
	for rows.Next() {
		p, err := scanProtocolFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ProtocolRepo) ListApplicationIDs(ctx context.Context, protocolID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `SELECT application_id FROM protocol_applications WHERE protocol_id = $1`, protocolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (r *ProtocolRepo) ListVotes(ctx context.Context, protocolID uuid.UUID) ([]*domain.CommitteeVote, error) {
	return listVotes(ctx, r.db, protocolID)
}

// EligibleApplicationIDs returns approved applications not yet attached to
// any protocol_applications row.
func (r *ProtocolRepo) EligibleApplicationIDs(ctx context.Context) ([]uuid.UUID, error) {
	const q = `
		SELECT a.id FROM applications a
		WHERE a.status = 'approved'
		AND NOT EXISTS (SELECT 1 FROM protocol_applications pa WHERE pa.application_id = a.id)
		ORDER BY a.created_at`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (r *ProtocolRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM protocols WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *ProtocolRepo) WithVoteLock(ctx context.Context, protocolID uuid.UUID, fn func(ctx context.Context, protocol *domain.Protocol, tx repository.ProtocolTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+protocolColumns+` FROM protocols WHERE id = $1 FOR UPDATE`, protocolID)
	protocol, err := scanProtocolRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, protocol, &protocolTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type protocolTx struct {
	tx pgx.Tx
}

func (t *protocolTx) GetVote(ctx context.Context, protocolID, committeeMemberID uuid.UUID) (*domain.CommitteeVote, error) {
	const q = `
		SELECT id, protocol_id, committee_member_id, decision, reason, voted_at
		FROM committee_votes WHERE protocol_id = $1 AND committee_member_id = $2`
	return scanVoteRow(t.tx.QueryRow(ctx, q, protocolID, committeeMemberID))
}

func (t *protocolTx) SetVote(ctx context.Context, protocolID, committeeMemberID uuid.UUID, decision domain.VoteDecision, reason *string) error {
	const q = `
		UPDATE committee_votes SET decision = $3, reason = $4, voted_at = now()
		WHERE protocol_id = $1 AND committee_member_id = $2`
	tag, err := t.tx.Exec(ctx, q, protocolID, committeeMemberID, string(decision), reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (t *protocolTx) ListVotes(ctx context.Context, protocolID uuid.UUID) ([]*domain.CommitteeVote, error) {
	return listVotes(ctx, t.tx, protocolID)
}

func (t *protocolTx) SetProtocolStatus(ctx context.Context, protocolID uuid.UUID, status domain.ProtocolStatus) error {
	_, err := t.tx.Exec(ctx, `UPDATE protocols SET status = $2, updated_at = now() WHERE id = $1`, protocolID, string(status))
	return err
}

// voteQuerier is satisfied by both *pgxpool.Pool and pgx.Tx.
type voteQuerier interface {
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

func listVotes(ctx context.Context, db voteQuerier, protocolID uuid.UUID) ([]*domain.CommitteeVote, error) {
	const q = `
		SELECT id, protocol_id, committee_member_id, decision, reason, voted_at
		FROM committee_votes WHERE protocol_id = $1`
	rows, err := db.Query(ctx, q, protocolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.CommitteeVote
	for rows.Next() {
		v, err := scanVoteFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func scanVoteRow(row pgx.Row) (*domain.CommitteeVote, error) {
	v := &domain.CommitteeVote{}
	var decision *string
	err := row.Scan(&v.ID, &v.ProtocolID, &v.CommitteeMemberID, &decision, &v.Reason, &v.VotedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	if decision != nil {
		d := domain.VoteDecision(*decision)
		v.Decision = &d
	}
	return v, nil
}

type voteRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanVoteFields(row voteRowScanner) (*domain.CommitteeVote, error) {
	v := &domain.CommitteeVote{}
	var decision *string
	if err := row.Scan(&v.ID, &v.ProtocolID, &v.CommitteeMemberID, &decision, &v.Reason, &v.VotedAt); err != nil {
		return nil, err
	}
	if decision != nil {
		d := domain.VoteDecision(*decision)
		v.Decision = &d
	}
	return v, nil
}

func scanProtocolRow(row pgx.Row) (*domain.Protocol, error) {
	return scanProtocolFields(row)
}

type protocolRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanProtocolFields(row protocolRowScanner) (*domain.Protocol, error) {
	p := &domain.Protocol{}
	var status string
	err := row.Scan(&p.ID, &p.Number, &status, &p.CreatedBy, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	p.Status = domain.ProtocolStatus(status)
	return p, nil
}
