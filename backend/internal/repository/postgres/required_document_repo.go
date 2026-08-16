package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type RequiredDocumentRepo struct {
	db *pgxpool.Pool
}

func NewRequiredDocumentRepo(db *pgxpool.Pool) *RequiredDocumentRepo {
	return &RequiredDocumentRepo{db: db}
}

func (r *RequiredDocumentRepo) Create(ctx context.Context, d *domain.RequiredDocument) error {
	const q = `INSERT INTO required_documents (name_kk, name_ru) VALUES ($1, $2) RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, d.NameKk, d.NameRu).Scan(&d.ID, &d.CreatedAt)
}

func (r *RequiredDocumentRepo) List(ctx context.Context) ([]*domain.RequiredDocument, error) {
	const q = `SELECT id, name_kk, name_ru, created_at FROM required_documents ORDER BY name_kk`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.RequiredDocument
	for rows.Next() {
		d := &domain.RequiredDocument{}
		if err := rows.Scan(&d.ID, &d.NameKk, &d.NameRu, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *RequiredDocumentRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM required_documents WHERE id = $1`, id)
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
