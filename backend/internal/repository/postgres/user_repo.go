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

type UserRepo struct {
	db *pgxpool.Pool
}

func NewUserRepo(db *pgxpool.Pool) *UserRepo {
	return &UserRepo{db: db}
}

const userColumns = `
	id, full_name, email, phone, iin, password_hash, role, is_committee_member,
	is_chairperson, approval_status, avatar_url, email_verified_at, email_verification_code,
	email_verification_expires_at, created_at, updated_at`

func (r *UserRepo) Create(ctx context.Context, u *domain.User) error {
	const q = `
		INSERT INTO users (
			full_name, email, phone, iin, password_hash, role, is_committee_member,
			is_chairperson, approval_status, email_verified_at, email_verification_code,
			email_verification_expires_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRow(ctx, q,
		u.FullName, u.Email, u.Phone, u.IIN, u.PasswordHash, string(u.Role), u.IsCommitteeMember, u.IsChairperson,
		string(u.ApprovalStatus), u.EmailVerifiedAt, u.EmailVerificationCode, u.EmailVerificationExpiresAt,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return nil
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE id = $1`
	return scanUser(r.db.QueryRow(ctx, q, id))
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE email = $1`
	return scanUser(r.db.QueryRow(ctx, q, email))
}

func (r *UserRepo) GetByIIN(ctx context.Context, iin string) (*domain.User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE iin = $1`
	return scanUser(r.db.QueryRow(ctx, q, iin))
}

func (r *UserRepo) UpdateRole(ctx context.Context, id uuid.UUID, role domain.Role) error {
	const q = `UPDATE users SET role = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, string(role))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// UpdateCommitteeMember toggles the flag directly — unlike chairperson,
// there's no "only one" constraint on committee membership.
func (r *UserRepo) UpdateCommitteeMember(ctx context.Context, id uuid.UUID, isCommitteeMember bool) error {
	const q = `UPDATE users SET is_committee_member = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, isCommitteeMember)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// UpdateChairperson only ever leaves at most one user with is_chairperson =
// true (enforced by idx_users_single_chairperson too): assigning a new
// chairperson atomically clears whoever held it before, in the same
// transaction, so there's never a window with two.
func (r *UserRepo) UpdateChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error {
	if !isChairperson {
		const q = `UPDATE users SET is_chairperson = false, updated_at = now() WHERE id = $1`
		tag, err := r.db.Exec(ctx, q, id)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return repository.ErrNotFound
		}
		return nil
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `UPDATE users SET is_chairperson = false, updated_at = now() WHERE is_chairperson = true AND id != $1`, id); err != nil {
		return err
	}
	tag, err := tx.Exec(ctx, `UPDATE users SET is_chairperson = true, updated_at = now() WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return tx.Commit(ctx)
}

func (r *UserRepo) UpdateAvatar(ctx context.Context, id uuid.UUID, avatarURL *string) error {
	const q = `UPDATE users SET avatar_url = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, avatarURL)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *UserRepo) ListCommitteeMembers(ctx context.Context) ([]*domain.User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE is_committee_member = true ORDER BY full_name`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		u, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) ListByRole(ctx context.Context, role domain.Role) ([]*domain.User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE role = $1 ORDER BY full_name`
	rows, err := r.db.Query(ctx, q, string(role))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		u, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) List(ctx context.Context, role *domain.Role) ([]*domain.User, error) {
	baseQ := `SELECT ` + userColumns + ` FROM users`
	var rows pgx.Rows
	var err error
	if role != nil {
		rows, err = r.db.Query(ctx, baseQ+` WHERE role = $1 ORDER BY full_name`, string(*role))
	} else {
		rows, err = r.db.Query(ctx, baseQ+` ORDER BY full_name`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		u, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) ListPendingStudents(ctx context.Context) ([]*domain.User, error) {
	q := `SELECT ` + userColumns + ` FROM users WHERE role = 'student' AND approval_status = 'pending' ORDER BY created_at`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []*domain.User
	for rows.Next() {
		u, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func (r *UserRepo) UpdateApprovalStatus(ctx context.Context, id uuid.UUID, status domain.ApprovalStatus) error {
	const q = `UPDATE users SET approval_status = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, string(status))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *UserRepo) UpdatePassword(ctx context.Context, id uuid.UUID, passwordHash string) error {
	const q = `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *UserRepo) SetEmailVerificationCode(ctx context.Context, id uuid.UUID, code string, expiresAt time.Time) error {
	const q = `
		UPDATE users
		SET email_verification_code = $2, email_verification_expires_at = $3, updated_at = now()
		WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, code, expiresAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *UserRepo) MarkEmailVerified(ctx context.Context, id uuid.UUID) error {
	const q = `
		UPDATE users
		SET email_verified_at = now(), email_verification_code = NULL,
			email_verification_expires_at = NULL, updated_at = now()
		WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// Delete returns repository.ErrConflict if the user is still referenced
// elsewhere (applications, contracts, votes, etc. have no ON DELETE clause on
// their user FKs, so Postgres rejects the delete with a foreign_key_violation).
func (r *UserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
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

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanUser(row pgx.Row) (*domain.User, error) {
	return scanUserRow(row)
}

func scanUserRow(row rowScanner) (*domain.User, error) {
	u := &domain.User{}
	var role string
	var approvalStatus string
	err := row.Scan(
		&u.ID, &u.FullName, &u.Email, &u.Phone, &u.IIN, &u.PasswordHash, &role, &u.IsCommitteeMember,
		&u.IsChairperson, &approvalStatus, &u.AvatarURL, &u.EmailVerifiedAt, &u.EmailVerificationCode, &u.EmailVerificationExpiresAt,
		&u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	u.Role = domain.Role(role)
	u.ApprovalStatus = domain.ApprovalStatus(approvalStatus)
	return u, nil
}
