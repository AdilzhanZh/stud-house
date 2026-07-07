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

const exitRequestColumns = `id, room_resident_id, student_id, reason, status, requested_at, decided_by, decided_at, comment`

type ExitRequestRepo struct {
	db *pgxpool.Pool
}

func NewExitRequestRepo(db *pgxpool.Pool) *ExitRequestRepo {
	return &ExitRequestRepo{db: db}
}

func (r *ExitRequestRepo) Create(ctx context.Context, e *domain.ExitRequest) error {
	const q = `
		INSERT INTO exit_requests (room_resident_id, student_id, reason, status)
		VALUES ($1, $2, $3, $4)
		RETURNING id, requested_at`
	err := r.db.QueryRow(ctx, q, e.RoomResidentID, e.StudentID, e.Reason, string(e.Status)).Scan(&e.ID, &e.RequestedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return nil
}

func (r *ExitRequestRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.ExitRequest, error) {
	row := r.db.QueryRow(ctx, `SELECT `+exitRequestColumns+` FROM exit_requests WHERE id = $1`, id)
	return scanExitRequestRow(row)
}

func (r *ExitRequestRepo) GetActiveByRoomResident(ctx context.Context, roomResidentID uuid.UUID) (*domain.ExitRequest, error) {
	const q = `SELECT ` + exitRequestColumns + ` FROM exit_requests WHERE room_resident_id = $1 AND status = 'pending'`
	return scanExitRequestRow(r.db.QueryRow(ctx, q, roomResidentID))
}

func (r *ExitRequestRepo) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.ExitRequest, error) {
	rows, err := r.db.Query(ctx, `SELECT `+exitRequestColumns+` FROM exit_requests WHERE student_id = $1 ORDER BY requested_at DESC`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanExitRequestRows(rows)
}

func (r *ExitRequestRepo) List(ctx context.Context, status *domain.ExitRequestStatus) ([]*domain.ExitRequest, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+exitRequestColumns+` FROM exit_requests WHERE status = $1 ORDER BY requested_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+exitRequestColumns+` FROM exit_requests ORDER BY requested_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanExitRequestRows(rows)
}

func (r *ExitRequestRepo) WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, exitRequest *domain.ExitRequest, tx repository.ExitRequestTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+exitRequestColumns+` FROM exit_requests WHERE id = $1 FOR UPDATE`, id)
	exitRequest, err := scanExitRequestRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, exitRequest, &exitRequestTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type exitRequestTx struct {
	tx pgx.Tx
}

func (t *exitRequestTx) SetDecision(ctx context.Context, id uuid.UUID, status domain.ExitRequestStatus, decidedBy uuid.UUID, comment *string) error {
	const q = `
		UPDATE exit_requests SET status = $2, decided_by = $3, decided_at = now(), comment = $4
		WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, string(status), decidedBy, comment)
	return err
}

func scanExitRequestRow(row pgx.Row) (*domain.ExitRequest, error) {
	return scanExitRequestFields(row)
}

type exitRequestRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanExitRequestFields(row exitRequestRowScanner) (*domain.ExitRequest, error) {
	e := &domain.ExitRequest{}
	var status string
	err := row.Scan(&e.ID, &e.RoomResidentID, &e.StudentID, &e.Reason, &status, &e.RequestedAt, &e.DecidedBy, &e.DecidedAt, &e.Comment)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	e.Status = domain.ExitRequestStatus(status)
	return e, nil
}

func scanExitRequestRows(rows pgx.Rows) ([]*domain.ExitRequest, error) {
	var out []*domain.ExitRequest
	for rows.Next() {
		e, err := scanExitRequestFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
