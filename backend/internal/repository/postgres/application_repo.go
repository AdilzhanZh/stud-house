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

const applicationColumns = `id, student_id, dormitory_id, status, preferred_room_type, preferred_room_id, notes, assigned_room_id, handled_by, created_at, updated_at`

type ApplicationRepo struct {
	db *pgxpool.Pool
}

func NewApplicationRepo(db *pgxpool.Pool) *ApplicationRepo {
	return &ApplicationRepo{db: db}
}

func (r *ApplicationRepo) Create(ctx context.Context, a *domain.Application) error {
	const q = `
		INSERT INTO applications (student_id, dormitory_id, status, preferred_room_type, preferred_room_id, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRow(ctx, q, a.StudentID, a.DormitoryID, string(a.Status), a.PreferredRoomType, a.PreferredRoomID, a.Notes).
		Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return nil
}

func (r *ApplicationRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Application, error) {
	row := r.db.QueryRow(ctx, `SELECT `+applicationColumns+` FROM applications WHERE id = $1`, id)
	return scanApplicationRow(row)
}

func (r *ApplicationRepo) GetActiveByStudent(ctx context.Context, studentID uuid.UUID) (*domain.Application, error) {
	const q = `
		SELECT ` + applicationColumns + `
		FROM applications
		WHERE student_id = $1 AND status IN ('pending', 'manager_review', 'needs_correction')
		LIMIT 1`
	return scanApplicationRow(r.db.QueryRow(ctx, q, studentID))
}

func (r *ApplicationRepo) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.Application, error) {
	rows, err := r.db.Query(ctx, `SELECT `+applicationColumns+` FROM applications WHERE student_id = $1 ORDER BY created_at DESC`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanApplicationRows(rows)
}

func (r *ApplicationRepo) List(ctx context.Context, status *domain.ApplicationStatus) ([]*domain.Application, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+applicationColumns+` FROM applications WHERE status = $1 ORDER BY created_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+applicationColumns+` FROM applications ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanApplicationRows(rows)
}

func (r *ApplicationRepo) ListByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.Application, error) {
	rows, err := r.db.Query(ctx, `SELECT `+applicationColumns+` FROM applications WHERE dormitory_id = $1`, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanApplicationRows(rows)
}

func (r *ApplicationRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM applications WHERE id = $1`, id)
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

func (r *ApplicationRepo) AddHistory(ctx context.Context, h *domain.ApplicationStatusHistory) error {
	return insertApplicationHistory(ctx, r.db, h)
}

func (r *ApplicationRepo) ListHistory(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationStatusHistory, error) {
	const q = `
		SELECT id, application_id, from_status, to_status, comment, changed_by, created_at
		FROM application_status_history WHERE application_id = $1 ORDER BY created_at`
	rows, err := r.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.ApplicationStatusHistory
	for rows.Next() {
		h := &domain.ApplicationStatusHistory{}
		var fromStatus, toStatus *string
		var to string
		if err := rows.Scan(&h.ID, &h.ApplicationID, &fromStatus, &toStatus, &h.Comment, &h.ChangedBy, &h.CreatedAt); err != nil {
			return nil, err
		}
		if fromStatus != nil {
			fs := domain.ApplicationStatus(*fromStatus)
			h.FromStatus = &fs
		}
		if toStatus != nil {
			to = *toStatus
		}
		h.ToStatus = domain.ApplicationStatus(to)
		out = append(out, h)
	}
	return out, rows.Err()
}

// WithLock runs fn inside a transaction with the application row locked via
// SELECT ... FOR UPDATE, so concurrent decision requests for the same
// application serialize instead of racing.
func (r *ApplicationRepo) WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, app *domain.Application, tx repository.ApplicationTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+applicationColumns+` FROM applications WHERE id = $1 FOR UPDATE`, id)
	app, err := scanApplicationRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, app, &applicationTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type applicationTx struct {
	tx pgx.Tx
}

func (t *applicationTx) SetDecision(ctx context.Context, id uuid.UUID, status domain.ApplicationStatus, assignedRoomID *uuid.UUID, handledBy uuid.UUID) error {
	const q = `UPDATE applications SET status = $2, assigned_room_id = $3, handled_by = $4, updated_at = now() WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, string(status), assignedRoomID, handledBy)
	return err
}

func (t *applicationTx) UpdateEditableFieldsAndResubmit(ctx context.Context, id uuid.UUID, preferredRoomType, notes *string) error {
	const q = `UPDATE applications SET preferred_room_type = $2, notes = $3, status = 'pending', updated_at = now() WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, preferredRoomType, notes)
	return err
}

func (t *applicationTx) AddHistory(ctx context.Context, h *domain.ApplicationStatusHistory) error {
	return insertApplicationHistory(ctx, t.tx, h)
}

// historyExecer is satisfied by both *pgxpool.Pool and pgx.Tx.
type historyExecer interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

func insertApplicationHistory(ctx context.Context, db historyExecer, h *domain.ApplicationStatusHistory) error {
	const q = `
		INSERT INTO application_status_history (application_id, from_status, to_status, comment, changed_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`
	var fromStatus *string
	if h.FromStatus != nil {
		s := string(*h.FromStatus)
		fromStatus = &s
	}
	return db.QueryRow(ctx, q, h.ApplicationID, fromStatus, string(h.ToStatus), h.Comment, h.ChangedBy).Scan(&h.ID, &h.CreatedAt)
}

func (r *ApplicationRepo) SetReapplyBlock(ctx context.Context, studentID uuid.UUID, blockedUntil time.Time) error {
	const q = `
		INSERT INTO application_reapply_blocks (student_id, blocked_until)
		VALUES ($1, $2)
		ON CONFLICT (student_id) DO UPDATE SET blocked_until = $2`
	_, err := r.db.Exec(ctx, q, studentID, blockedUntil)
	return err
}

func (r *ApplicationRepo) GetReapplyBlock(ctx context.Context, studentID uuid.UUID) (time.Time, error) {
	var blockedUntil time.Time
	err := r.db.QueryRow(ctx, `SELECT blocked_until FROM application_reapply_blocks WHERE student_id = $1`, studentID).Scan(&blockedUntil)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return time.Time{}, repository.ErrNotFound
		}
		return time.Time{}, err
	}
	return blockedUntil, nil
}

func scanApplicationRow(row pgx.Row) (*domain.Application, error) {
	a := &domain.Application{}
	var status string
	err := row.Scan(&a.ID, &a.StudentID, &a.DormitoryID, &status, &a.PreferredRoomType, &a.PreferredRoomID, &a.Notes, &a.AssignedRoomID, &a.HandledBy, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	a.Status = domain.ApplicationStatus(status)
	return a, nil
}

func scanApplicationRows(rows pgx.Rows) ([]*domain.Application, error) {
	var out []*domain.Application
	for rows.Next() {
		a := &domain.Application{}
		var status string
		if err := rows.Scan(&a.ID, &a.StudentID, &a.DormitoryID, &status, &a.PreferredRoomType, &a.PreferredRoomID, &a.Notes, &a.AssignedRoomID, &a.HandledBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Status = domain.ApplicationStatus(status)
		out = append(out, a)
	}
	return out, rows.Err()
}
