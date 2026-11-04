package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

// eligibleResidentCondition selects the room_residents rows (aliased rr) a
// protocol can still be prepared for: the student lives there now, has never
// been in a protocol by either route, and has no approved application, which
// would list them as an applicant instead.
const eligibleResidentCondition = `
	rr.moved_out_at IS NULL
	AND NOT EXISTS (SELECT 1 FROM protocol_residents pr WHERE pr.student_id = rr.student_id)
	AND NOT EXISTS (
		SELECT 1 FROM applications a
		JOIN protocol_applications pa ON pa.application_id = a.id
		WHERE a.student_id = rr.student_id
	)
	AND NOT EXISTS (
		SELECT 1 FROM applications a
		WHERE a.student_id = rr.student_id AND a.status = 'approved'
	)`

func (r *ProtocolRepo) CreateWithStudents(ctx context.Context, protocol *domain.Protocol, applicationIDs, residentStudentIDs, committeeMemberIDs []uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAndValidateApprovedApplications(ctx, tx, applicationIDs); err != nil {
		return err
	}
	residents, err := lockEligibleResidents(ctx, tx, residentStudentIDs)
	if err != nil {
		return err
	}
	if err := insertProtocol(ctx, tx, protocol); err != nil {
		return err
	}
	if err := insertProtocolApplications(ctx, tx, protocol.ID, applicationIDs); err != nil {
		return err
	}
	if err := insertProtocolResidents(ctx, tx, protocol.ID, residents); err != nil {
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

type residentSnapshot struct {
	studentID     uuid.UUID
	dormitoryName string
	roomNumber    string
}

// lockEligibleResidents locks each student's active room_residents row and
// returns where they live now, or ErrResidentNotEligible if any of them can't
// be added to a protocol.
func lockEligibleResidents(ctx context.Context, tx pgx.Tx, studentIDs []uuid.UUID) ([]residentSnapshot, error) {
	if len(studentIDs) == 0 {
		return nil, nil
	}
	q := `
		SELECT rr.student_id, d.name, r.room_number
		FROM room_residents rr
		JOIN rooms r ON r.id = rr.room_id
		JOIN dormitories d ON d.id = r.dormitory_id
		WHERE rr.student_id = ANY($1) AND ` + eligibleResidentCondition + `
		FOR UPDATE OF rr`
	rows, err := tx.Query(ctx, q, studentIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	residents := make([]residentSnapshot, 0, len(studentIDs))
	for rows.Next() {
		var s residentSnapshot
		if err := rows.Scan(&s.studentID, &s.dormitoryName, &s.roomNumber); err != nil {
			return nil, err
		}
		residents = append(residents, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(residents) != len(studentIDs) {
		return nil, repository.ErrResidentNotEligible
	}
	return residents, nil
}

func insertProtocolResidents(ctx context.Context, tx pgx.Tx, protocolID uuid.UUID, residents []residentSnapshot) error {
	const q = `
		INSERT INTO protocol_residents (protocol_id, student_id, dormitory_name, room_number)
		VALUES ($1, $2, $3, $4)`
	for _, s := range residents {
		if _, err := tx.Exec(ctx, q, protocolID, s.studentID, s.dormitoryName, s.roomNumber); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return repository.ErrConflict
			}
			return err
		}
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

// GetByApplicationID returns the protocol containing applicationID, if any
// — an approved application isn't necessarily attached to one yet, see
// ListCandidates. Returns ErrNotFound if none.
func (r *ProtocolRepo) GetByApplicationID(ctx context.Context, applicationID uuid.UUID) (*domain.Protocol, error) {
	// protocols' columns are qualified: protocol_applications has an id too.
	const q = `
		SELECT p.id, p.number, p.status, p.created_by, p.created_at, p.updated_at
		FROM protocols p
		JOIN protocol_applications pa ON pa.protocol_id = p.id
		WHERE pa.application_id = $1`
	row := r.db.QueryRow(ctx, q, applicationID)
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

func (r *ProtocolRepo) ListResidents(ctx context.Context, protocolID uuid.UUID) ([]*domain.ProtocolResident, error) {
	const q = `
		SELECT pr.student_id, u.full_name, u.email, u.phone, pr.dormitory_name, pr.room_number
		FROM protocol_residents pr
		JOIN users u ON u.id = pr.student_id
		WHERE pr.protocol_id = $1`
	rows, err := r.db.Query(ctx, q, protocolID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.ProtocolResident
	for rows.Next() {
		res := &domain.ProtocolResident{}
		if err := rows.Scan(&res.StudentID, &res.FullName, &res.Email, &res.Phone, &res.DormitoryName, &res.RoomNumber); err != nil {
			return nil, err
		}
		out = append(out, res)
	}
	return out, rows.Err()
}

func (r *ProtocolRepo) ListCandidates(ctx context.Context) ([]*domain.ProtocolCandidate, error) {
	q := `
		SELECT a.id, a.student_id, u.full_name, d.id AS dormitory_id, d.name AS dormitory_name, r.room_number
		FROM applications a
		JOIN users u ON u.id = a.student_id
		JOIN dormitories d ON d.id = a.dormitory_id
		LEFT JOIN rooms r ON r.id = a.assigned_room_id
		WHERE a.status = 'approved'
			AND NOT EXISTS (SELECT 1 FROM protocol_applications pa WHERE pa.application_id = a.id)
		UNION ALL
		SELECT NULL, rr.student_id, u.full_name, d.id, d.name, r.room_number
		FROM room_residents rr
		JOIN users u ON u.id = rr.student_id
		JOIN rooms r ON r.id = rr.room_id
		JOIN dormitories d ON d.id = r.dormitory_id
		WHERE ` + eligibleResidentCondition + `
		ORDER BY dormitory_name, full_name`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.ProtocolCandidate
	for rows.Next() {
		c := &domain.ProtocolCandidate{}
		if err := rows.Scan(&c.ApplicationID, &c.StudentID, &c.StudentFullName, &c.DormitoryID, &c.DormitoryName, &c.RoomNumber); err != nil {
			return nil, err
		}
		out = append(out, c)
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

func (r *ProtocolRepo) DeleteOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := r.db.Exec(ctx, `DELETE FROM protocols WHERE created_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
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
