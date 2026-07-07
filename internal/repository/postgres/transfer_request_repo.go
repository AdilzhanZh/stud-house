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

const transferRequestColumns = `id, student_id, current_room_id, requested_dormitory_id, requested_room_id, reason, status, decided_by, decided_at, comment, created_at`

type TransferRequestRepo struct {
	db *pgxpool.Pool
}

func NewTransferRequestRepo(db *pgxpool.Pool) *TransferRequestRepo {
	return &TransferRequestRepo{db: db}
}

func (r *TransferRequestRepo) Create(ctx context.Context, t *domain.TransferRequest) error {
	const q = `
		INSERT INTO transfer_requests (student_id, current_room_id, requested_dormitory_id, requested_room_id, reason, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`
	err := r.db.QueryRow(ctx, q, t.StudentID, t.CurrentRoomID, t.RequestedDormitoryID, t.RequestedRoomID, t.Reason, string(t.Status)).
		Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return nil
}

func (r *TransferRequestRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.TransferRequest, error) {
	row := r.db.QueryRow(ctx, `SELECT `+transferRequestColumns+` FROM transfer_requests WHERE id = $1`, id)
	return scanTransferRequestRow(row)
}

func (r *TransferRequestRepo) GetActiveByStudent(ctx context.Context, studentID uuid.UUID) (*domain.TransferRequest, error) {
	const q = `SELECT ` + transferRequestColumns + ` FROM transfer_requests WHERE student_id = $1 AND status = 'pending'`
	return scanTransferRequestRow(r.db.QueryRow(ctx, q, studentID))
}

func (r *TransferRequestRepo) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.TransferRequest, error) {
	rows, err := r.db.Query(ctx, `SELECT `+transferRequestColumns+` FROM transfer_requests WHERE student_id = $1 ORDER BY created_at DESC`, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransferRequestRows(rows)
}

func (r *TransferRequestRepo) List(ctx context.Context, status *domain.TransferRequestStatus) ([]*domain.TransferRequest, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+transferRequestColumns+` FROM transfer_requests WHERE status = $1 ORDER BY created_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+transferRequestColumns+` FROM transfer_requests ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransferRequestRows(rows)
}

func (r *TransferRequestRepo) WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, t *domain.TransferRequest, tx repository.TransferRequestTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+transferRequestColumns+` FROM transfer_requests WHERE id = $1 FOR UPDATE`, id)
	t, err := scanTransferRequestRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, t, &transferRequestTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type transferRequestTx struct {
	tx pgx.Tx
}

func (t *transferRequestTx) SetDecision(ctx context.Context, id uuid.UUID, status domain.TransferRequestStatus, decidedBy uuid.UUID, comment *string) error {
	const q = `
		UPDATE transfer_requests SET status = $2, decided_by = $3, decided_at = now(), comment = $4
		WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, string(status), decidedBy, comment)
	return err
}

func scanTransferRequestRow(row pgx.Row) (*domain.TransferRequest, error) {
	return scanTransferRequestFields(row)
}

type transferRequestRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanTransferRequestFields(row transferRequestRowScanner) (*domain.TransferRequest, error) {
	t := &domain.TransferRequest{}
	var status string
	err := row.Scan(&t.ID, &t.StudentID, &t.CurrentRoomID, &t.RequestedDormitoryID, &t.RequestedRoomID, &t.Reason, &status, &t.DecidedBy, &t.DecidedAt, &t.Comment, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	t.Status = domain.TransferRequestStatus(status)
	return t, nil
}

func scanTransferRequestRows(rows pgx.Rows) ([]*domain.TransferRequest, error) {
	var out []*domain.TransferRequest
	for rows.Next() {
		t, err := scanTransferRequestFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
