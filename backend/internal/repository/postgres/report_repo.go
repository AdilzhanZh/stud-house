package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

const reportColumns = `id, template_id, created_by, status, previous_report_id, created_at, updated_at`

type ReportRepo struct {
	db *pgxpool.Pool
}

func NewReportRepo(db *pgxpool.Pool) *ReportRepo {
	return &ReportRepo{db: db}
}

func (r *ReportRepo) CreateWithApplications(ctx context.Context, report *domain.Report, applicationIDs []uuid.UUID, committeeMemberIDs []uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := lockAndValidateApprovedApplications(ctx, tx, applicationIDs); err != nil {
		return err
	}
	if err := insertReport(ctx, tx, report); err != nil {
		return err
	}
	if err := insertReportApplications(ctx, tx, report.ID, applicationIDs); err != nil {
		return err
	}
	if err := insertCommitteeVotes(ctx, tx, report.ID, committeeMemberIDs); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ReportRepo) Revise(ctx context.Context, oldReportID uuid.UUID, newReport *domain.Report, newApplicationIDs, droppedApplicationIDs []uuid.UUID, droppedComment string, changedBy uuid.UUID, committeeMemberIDs []uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var oldStatus string
	err = tx.QueryRow(ctx, `SELECT status FROM reports WHERE id = $1 FOR UPDATE`, oldReportID).Scan(&oldStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}
	if oldStatus != string(domain.ReportRejected) {
		return repository.ErrConflict
	}

	for _, appID := range droppedApplicationIDs {
		tag, err := tx.Exec(ctx, `UPDATE applications SET status = 'rejected', updated_at = now() WHERE id = $1 AND status = 'approved'`, appID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			continue
		}
		const historyQ = `
			INSERT INTO application_status_history (application_id, from_status, to_status, comment, changed_by)
			VALUES ($1, 'approved', 'rejected', $2, $3)`
		if _, err := tx.Exec(ctx, historyQ, appID, droppedComment, changedBy); err != nil {
			return err
		}
	}

	if err := lockAndValidateApprovedApplications(ctx, tx, newApplicationIDs); err != nil {
		return err
	}
	if err := insertReport(ctx, tx, newReport); err != nil {
		return err
	}
	if err := insertReportApplications(ctx, tx, newReport.ID, newApplicationIDs); err != nil {
		return err
	}
	if err := insertCommitteeVotes(ctx, tx, newReport.ID, committeeMemberIDs); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// lockAndValidateApprovedApplications locks the given application rows and
// ensures each exists, is status='approved', and isn't already attached to
// another pending_committee report.
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

	// Reports are auto-approved on creation (see ReportService.CreateReport),
	// so an application is "already reported" as soon as it's attached to
	// any non-rejected report — not just one still pending_committee (that
	// status is now effectively transient/unused). Rejected reports don't
	// block reuse: Revise() re-adds their kept applications to a fresh
	// report, and dropped ones are marked application.status='rejected'
	// so they wouldn't pass the approved-status check above anyway.
	var conflictCount int
	const conflictQ = `
		SELECT COUNT(*) FROM report_applications ra
		JOIN reports r ON r.id = ra.report_id
		WHERE ra.application_id = ANY($1) AND r.status != 'rejected'`
	if err := tx.QueryRow(ctx, conflictQ, applicationIDs).Scan(&conflictCount); err != nil {
		return err
	}
	if conflictCount > 0 {
		return repository.ErrConflict
	}

	return nil
}

func insertReport(ctx context.Context, tx pgx.Tx, report *domain.Report) error {
	const q = `
		INSERT INTO reports (template_id, created_by, status, previous_report_id)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`
	return tx.QueryRow(ctx, q, report.TemplateID, report.CreatedBy, string(report.Status), report.PreviousReportID).
		Scan(&report.ID, &report.CreatedAt, &report.UpdatedAt)
}

func insertReportApplications(ctx context.Context, tx pgx.Tx, reportID uuid.UUID, applicationIDs []uuid.UUID) error {
	for _, appID := range applicationIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO report_applications (report_id, application_id) VALUES ($1, $2)`, reportID, appID); err != nil {
			return err
		}
	}
	return nil
}

// insertCommitteeVotes seeds one NULL-decision row per committee member —
// each must cast a real vote (see ReportService.Vote) before the report can
// resolve to approved/rejected.
func insertCommitteeVotes(ctx context.Context, tx pgx.Tx, reportID uuid.UUID, committeeMemberIDs []uuid.UUID) error {
	for _, memberID := range committeeMemberIDs {
		const q = `INSERT INTO committee_votes (report_id, committee_member_id, decision, reason, voted_at) VALUES ($1, $2, NULL, NULL, NULL)`
		if _, err := tx.Exec(ctx, q, reportID, memberID); err != nil {
			return err
		}
	}
	return nil
}

func (r *ReportRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Report, error) {
	row := r.db.QueryRow(ctx, `SELECT `+reportColumns+` FROM reports WHERE id = $1`, id)
	return scanReportRow(row)
}

func (r *ReportRepo) List(ctx context.Context, status *domain.ReportStatus) ([]*domain.Report, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+reportColumns+` FROM reports WHERE status = $1 ORDER BY created_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+reportColumns+` FROM reports ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Report
	for rows.Next() {
		rpt, err := scanReportFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rpt)
	}
	return out, rows.Err()
}

func (r *ReportRepo) ListApplicationIDs(ctx context.Context, reportID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `SELECT application_id FROM report_applications WHERE report_id = $1`, reportID)
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

func (r *ReportRepo) ListVotes(ctx context.Context, reportID uuid.UUID) ([]*domain.CommitteeVote, error) {
	return listVotes(ctx, r.db, reportID)
}

// Delete returns repository.ErrConflict if another report's
// previous_report_id still points at this one (previous_report_id has no ON
// DELETE clause, so Postgres rejects the delete with a foreign_key_violation).
func (r *ReportRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM reports WHERE id = $1`, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return repository.ErrConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *ReportRepo) WithVoteLock(ctx context.Context, reportID uuid.UUID, fn func(ctx context.Context, report *domain.Report, tx repository.ReportTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+reportColumns+` FROM reports WHERE id = $1 FOR UPDATE`, reportID)
	report, err := scanReportRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, report, &reportTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type reportTx struct {
	tx pgx.Tx
}

func (t *reportTx) GetVote(ctx context.Context, reportID, committeeMemberID uuid.UUID) (*domain.CommitteeVote, error) {
	const q = `
		SELECT id, report_id, committee_member_id, decision, reason, voted_at
		FROM committee_votes WHERE report_id = $1 AND committee_member_id = $2`
	return scanVoteRow(t.tx.QueryRow(ctx, q, reportID, committeeMemberID))
}

func (t *reportTx) SetVote(ctx context.Context, reportID, committeeMemberID uuid.UUID, decision domain.VoteDecision, reason *string) error {
	const q = `
		UPDATE committee_votes SET decision = $3, reason = $4, voted_at = now()
		WHERE report_id = $1 AND committee_member_id = $2`
	tag, err := t.tx.Exec(ctx, q, reportID, committeeMemberID, string(decision), reason)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (t *reportTx) ListVotes(ctx context.Context, reportID uuid.UUID) ([]*domain.CommitteeVote, error) {
	return listVotes(ctx, t.tx, reportID)
}

func (t *reportTx) SetReportStatus(ctx context.Context, reportID uuid.UUID, status domain.ReportStatus) error {
	_, err := t.tx.Exec(ctx, `UPDATE reports SET status = $2, updated_at = now() WHERE id = $1`, reportID, string(status))
	return err
}

// voteQuerier is satisfied by both *pgxpool.Pool and pgx.Tx.
type voteQuerier interface {
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

func listVotes(ctx context.Context, db voteQuerier, reportID uuid.UUID) ([]*domain.CommitteeVote, error) {
	const q = `
		SELECT id, report_id, committee_member_id, decision, reason, voted_at
		FROM committee_votes WHERE report_id = $1`
	rows, err := db.Query(ctx, q, reportID)
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
	err := row.Scan(&v.ID, &v.ReportID, &v.CommitteeMemberID, &decision, &v.Reason, &v.VotedAt)
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
	if err := row.Scan(&v.ID, &v.ReportID, &v.CommitteeMemberID, &decision, &v.Reason, &v.VotedAt); err != nil {
		return nil, err
	}
	if decision != nil {
		d := domain.VoteDecision(*decision)
		v.Decision = &d
	}
	return v, nil
}

func scanReportRow(row pgx.Row) (*domain.Report, error) {
	return scanReportFields(row)
}

type reportRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanReportFields(row reportRowScanner) (*domain.Report, error) {
	rpt := &domain.Report{}
	var status string
	err := row.Scan(&rpt.ID, &rpt.TemplateID, &rpt.CreatedBy, &status, &rpt.PreviousReportID, &rpt.CreatedAt, &rpt.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	rpt.Status = domain.ReportStatus(status)
	return rpt, nil
}
