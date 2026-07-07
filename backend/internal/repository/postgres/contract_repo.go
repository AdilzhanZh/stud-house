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

const contractColumns = `id, application_id, file_url, status, sent_at, responded_at, response_deadline, reminder_sent_at, created_at`

type ContractRepo struct {
	db *pgxpool.Pool
}

func NewContractRepo(db *pgxpool.Pool) *ContractRepo {
	return &ContractRepo{db: db}
}

func (r *ContractRepo) CreateIfNotExists(ctx context.Context, c *domain.Contract) (bool, error) {
	const q = `
		INSERT INTO contracts (application_id, file_url, status, sent_at, response_deadline)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (application_id) DO NOTHING
		RETURNING id, sent_at, created_at`
	err := r.db.QueryRow(ctx, q, c.ApplicationID, c.FileURL, string(c.Status), c.SentAt, c.ResponseDeadline).
		Scan(&c.ID, &c.SentAt, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (r *ContractRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Contract, error) {
	row := r.db.QueryRow(ctx, `SELECT `+contractColumns+` FROM contracts WHERE id = $1`, id)
	return scanContractRow(row)
}

func (r *ContractRepo) GetByApplicationID(ctx context.Context, applicationID uuid.UUID) (*domain.Contract, error) {
	row := r.db.QueryRow(ctx, `SELECT `+contractColumns+` FROM contracts WHERE application_id = $1`, applicationID)
	return scanContractRow(row)
}

func (r *ContractRepo) ListExpiredSent(ctx context.Context, now time.Time) ([]*domain.Contract, error) {
	rows, err := r.db.Query(ctx, `SELECT `+contractColumns+` FROM contracts WHERE status = 'sent' AND response_deadline < $1`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Contract
	for rows.Next() {
		c, err := scanContractFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *ContractRepo) ListApproachingDeadline(ctx context.Context, from, to time.Time) ([]*domain.Contract, error) {
	const q = `
		SELECT ` + contractColumns + `
		FROM contracts
		WHERE status = 'sent' AND response_deadline BETWEEN $1 AND $2 AND reminder_sent_at IS NULL`
	rows, err := r.db.Query(ctx, q, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Contract
	for rows.Next() {
		c, err := scanContractFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *ContractRepo) MarkReminderSent(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE contracts SET reminder_sent_at = now() WHERE id = $1`, id)
	return err
}

func (r *ContractRepo) List(ctx context.Context, status *domain.ContractStatus) ([]*domain.Contract, error) {
	var rows pgx.Rows
	var err error
	if status != nil {
		rows, err = r.db.Query(ctx, `SELECT `+contractColumns+` FROM contracts WHERE status = $1 ORDER BY created_at DESC`, string(*status))
	} else {
		rows, err = r.db.Query(ctx, `SELECT `+contractColumns+` FROM contracts ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Contract
	for rows.Next() {
		c, err := scanContractFields(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *ContractRepo) GetDormitoryPrice(ctx context.Context, dormitoryID uuid.UUID) (*float64, error) {
	var price *float64
	err := r.db.QueryRow(ctx, `SELECT price_per_semester FROM dormitories WHERE id = $1`, dormitoryID).Scan(&price)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return price, nil
}

func (r *ContractRepo) WithLock(ctx context.Context, id uuid.UUID, fn func(ctx context.Context, contract *domain.Contract, tx repository.ContractTx) error) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `SELECT `+contractColumns+` FROM contracts WHERE id = $1 FOR UPDATE`, id)
	contract, err := scanContractRow(row)
	if err != nil {
		return err
	}

	if err := fn(ctx, contract, &contractTx{tx: tx}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type contractTx struct {
	tx pgx.Tx
}

func (t *contractTx) SetStatus(ctx context.Context, id uuid.UUID, status domain.ContractStatus, respondedAt *time.Time) error {
	const q = `UPDATE contracts SET status = $2, responded_at = $3 WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, string(status), respondedAt)
	return err
}

func (t *contractTx) CreatePayment(ctx context.Context, p *domain.Payment) error {
	const q = `
		INSERT INTO payments (contract_id, amount, currency, status)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at`
	return t.tx.QueryRow(ctx, q, p.ContractID, p.Amount, p.Currency, string(p.Status)).Scan(&p.ID, &p.CreatedAt)
}

func (t *contractTx) MarkApplicationRejected(ctx context.Context, applicationID uuid.UUID, comment string, changedBy uuid.UUID) error {
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

func (t *contractTx) FreeActiveRoomResident(ctx context.Context, studentID uuid.UUID) error {
	_, err := t.tx.Exec(ctx, `UPDATE room_residents SET moved_out_at = now() WHERE student_id = $1 AND moved_out_at IS NULL`, studentID)
	return err
}

func (t *contractTx) Extend(ctx context.Context, id uuid.UUID, newDeadline time.Time) error {
	const q = `UPDATE contracts SET status = 'sent', response_deadline = $2, reminder_sent_at = NULL WHERE id = $1`
	_, err := t.tx.Exec(ctx, q, id, newDeadline)
	return err
}

func scanContractRow(row pgx.Row) (*domain.Contract, error) {
	return scanContractFields(row)
}

type contractRowScanner interface {
	Scan(dest ...interface{}) error
}

func scanContractFields(row contractRowScanner) (*domain.Contract, error) {
	c := &domain.Contract{}
	var status string
	err := row.Scan(&c.ID, &c.ApplicationID, &c.FileURL, &status, &c.SentAt, &c.RespondedAt, &c.ResponseDeadline, &c.ReminderSentAt, &c.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	c.Status = domain.ContractStatus(status)
	return c, nil
}
