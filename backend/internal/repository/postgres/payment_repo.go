package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

const paymentColumns = `id, contract_id, amount, currency, receipt_file_url, status, submitted_at, confirmed_by, confirmed_at, deadline, reminder_sent_at, created_at`

type PaymentRepo struct {
	db *pgxpool.Pool
}

func NewPaymentRepo(db *pgxpool.Pool) *PaymentRepo {
	return &PaymentRepo{db: db}
}

func (r *PaymentRepo) Create(ctx context.Context, p *domain.Payment) error {
	const q = `
		INSERT INTO payments (contract_id, amount, currency, status, deadline)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, p.ContractID, p.Amount, p.Currency, string(p.Status), p.Deadline).Scan(&p.ID, &p.CreatedAt)
}

func (r *PaymentRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Payment, error) {
	row := r.db.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE id = $1`, id)
	return scanPaymentRow(row)
}

func (r *PaymentRepo) GetByContractID(ctx context.Context, contractID uuid.UUID) (*domain.Payment, error) {
	row := r.db.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE contract_id = $1`, contractID)
	return scanPaymentRow(row)
}

func (r *PaymentRepo) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.Payment, error) {
	const q = `
		SELECT p.id, p.contract_id, p.amount, p.currency, p.receipt_file_url, p.status, p.submitted_at, p.confirmed_by, p.confirmed_at, p.deadline, p.reminder_sent_at, p.created_at
		FROM payments p
		JOIN contracts c ON c.id = p.contract_id
		JOIN applications a ON a.id = c.application_id
		WHERE a.student_id = $1
		ORDER BY p.created_at DESC`
	rows, err := r.db.Query(ctx, q, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Payment
	for rows.Next() {
		p, err := scanPaymentFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PaymentRepo) List(ctx context.Context, status *domain.PaymentStatus) ([]*domain.Payment, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+paymentColumns+` FROM payments WHERE status = $1 ORDER BY created_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+paymentColumns+` FROM payments ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Payment
	for rows.Next() {
		p, err := scanPaymentFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// ListExpiredPending returns 'pending'/'submitted' payments whose deadline
// is already in the past (candidates to flag for manager decision).
func (r *PaymentRepo) ListExpiredPending(ctx context.Context, now time.Time) ([]*domain.Payment, error) {
	const q = `SELECT ` + paymentColumns + ` FROM payments WHERE status IN ('pending', 'submitted') AND deadline < $1`
	rows, err := r.db.Query(ctx, q, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Payment
	for rows.Next() {
		p, err := scanPaymentFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PaymentRepo) ListApproachingDeadline(ctx context.Context, from, to time.Time) ([]*domain.Payment, error) {
	const q = `
		SELECT ` + paymentColumns + `
		FROM payments
		WHERE status IN ('pending', 'submitted') AND deadline BETWEEN $1 AND $2 AND reminder_sent_at IS NULL`
	rows, err := r.db.Query(ctx, q, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Payment
	for rows.Next() {
		p, err := scanPaymentFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PaymentRepo) MarkReminderSent(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE payments SET reminder_sent_at = now() WHERE id = $1`, id)
	return err
}

func (r *PaymentRepo) WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, payment *domain.Payment, tx repository.PaymentTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+paymentColumns+` FROM payments WHERE id = $1 FOR UPDATE`, id)
	payment, err := scanPaymentRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, payment, &paymentTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type paymentTx struct {
	tx pgx.Tx
}

func (t *paymentTx) SetSubmitted(ctx context.Context, id uuid.UUID, receiptFileURL string) error {
	const q = `UPDATE payments SET status = 'submitted', receipt_file_url = $2, submitted_at = now() WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, receiptFileURL)
	return err
}

func (t *paymentTx) SetDecision(ctx context.Context, id uuid.UUID, status domain.PaymentStatus, confirmedBy uuid.UUID) error {
	const q = `UPDATE payments SET status = $2, confirmed_by = $3, confirmed_at = now() WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, string(status), confirmedBy)
	return err
}

func (t *paymentTx) SetStatus(ctx context.Context, id uuid.UUID, status domain.PaymentStatus) error {
	const q = `UPDATE payments SET status = $2 WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, string(status))
	return err
}

func (t *paymentTx) MarkApplicationRejected(ctx context.Context, applicationID uuid.UUID, comment string, changedBy uuid.UUID) error {
	var fromStatus string
	err := t.tx.QueryRow(ctx, `SELECT status FROM applications WHERE id = $1 FOR UPDATE`, applicationID).Scan(&fromStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}

	if _, err := t.tx.Exec(ctx, `UPDATE applications SET status = 'rejected', updated_at = now() WHERE id = $1`, applicationID); err != nil {
		return err
	}

	const historyQ = `
		INSERT INTO application_status_history (application_id, from_status, to_status, comment, changed_by)
		VALUES ($1, $2, 'rejected', $3, $4)`
	_, err = t.tx.Exec(ctx, historyQ, applicationID, fromStatus, comment, changedBy)
	return err
}

func (t *paymentTx) FreeActiveRoomResident(ctx context.Context, studentID uuid.UUID) error {
	_, err := t.tx.Exec(ctx, `UPDATE room_residents SET moved_out_at = now() WHERE student_id = $1 AND moved_out_at IS NULL`, studentID)
	return err
}

func (t *paymentTx) Extend(ctx context.Context, id uuid.UUID, newDeadline time.Time) error {
	const q = `
		UPDATE payments
		SET status = CASE WHEN receipt_file_url IS NOT NULL THEN 'submitted' ELSE 'pending' END,
			deadline = $2, reminder_sent_at = NULL
		WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, newDeadline)
	return err
}

func (t *paymentTx) MarkApplicationSettled(ctx context.Context, applicationID uuid.UUID, changedBy uuid.UUID) error {
	var fromStatus string
	err := t.tx.QueryRow(ctx, `SELECT status FROM applications WHERE id = $1 FOR UPDATE`, applicationID).Scan(&fromStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}

	if _, err := t.tx.Exec(ctx, `UPDATE applications SET status = 'settled', updated_at = now() WHERE id = $1`, applicationID); err != nil {
		return err
	}

	const historyQ = `
		INSERT INTO application_status_history (application_id, from_status, to_status, comment, changed_by)
		VALUES ($1, $2, 'settled', $3, $4)`
	_, err = t.tx.Exec(ctx, historyQ, applicationID, fromStatus, "Төлем расталды", changedBy)
	return err
}

func scanPaymentRow(row pgx.Row) (*domain.Payment, error) {
	return scanPaymentFields(row)
}

type paymentRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanPaymentFields(row paymentRowScanner) (*domain.Payment, error) {
	p := &domain.Payment{}
	var status string
	err := row.Scan(&p.ID, &p.ContractID, &p.Amount, &p.Currency, &p.ReceiptFileURL, &status, &p.SubmittedAt, &p.ConfirmedBy, &p.ConfirmedAt, &p.Deadline, &p.ReminderSentAt, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	p.Status = domain.PaymentStatus(status)
	return p, nil
}
