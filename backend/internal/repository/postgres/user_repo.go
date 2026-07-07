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

type UserRepo struct {
	db *pgxpool.Pool
}

func NewUserRepo(db *pgxpool.Pool) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(ctx context.Context, u *domain.User) error {
	const q = `
		INSERT INTO users (full_name, email, phone, password_hash, role, is_chairperson)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRow(ctx, q, u.FullName, u.Email, u.Phone, u.PasswordHash, string(u.Role), u.IsChairperson).
		Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
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
	const q = `
		SELECT id, full_name, email, phone, password_hash, role, is_chairperson, created_at, updated_at
		FROM users WHERE id = $1`
	return scanUser(r.db.QueryRow(ctx, q, id))
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	const q = `
		SELECT id, full_name, email, phone, password_hash, role, is_chairperson, created_at, updated_at
		FROM users WHERE email = $1`
	return scanUser(r.db.QueryRow(ctx, q, email))
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

func (r *UserRepo) UpdateChairperson(ctx context.Context, id uuid.UUID, isChairperson bool) error {
	const q = `UPDATE users SET is_chairperson = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, isChairperson)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *UserRepo) ListByRole(ctx context.Context, role domain.Role) ([]*domain.User, error) {
	const q = `
		SELECT id, full_name, email, phone, password_hash, role, is_chairperson, created_at, updated_at
		FROM users WHERE role = $1 ORDER BY full_name`
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
	const baseQ = `SELECT id, full_name, email, phone, password_hash, role, is_chairperson, created_at, updated_at FROM users`
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

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanUser(row pgx.Row) (*domain.User, error) {
	return scanUserRow(row)
}

func scanUserRow(row rowScanner) (*domain.User, error) {
	u := &domain.User{}
	var role string
	err := row.Scan(&u.ID, &u.FullName, &u.Email, &u.Phone, &u.PasswordHash, &role, &u.IsChairperson, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	u.Role = domain.Role(role)
	return u, nil
}
