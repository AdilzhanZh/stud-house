package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type ContractTemplateRepo struct {
	db *pgxpool.Pool
}

func NewContractTemplateRepo(db *pgxpool.Pool) *ContractTemplateRepo {
	return &ContractTemplateRepo{db: db}
}

func (r *ContractTemplateRepo) Get(ctx context.Context, language domain.ContractLanguage) (*domain.ContractTemplate, error) {
	const q = `SELECT language, pages, updated_by, updated_at FROM contract_template WHERE language = $1`
	t := &domain.ContractTemplate{}
	err := r.db.QueryRow(ctx, q, string(language)).Scan(&t.Language, &t.Pages, &t.UpdatedBy, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *ContractTemplateRepo) Upsert(ctx context.Context, t *domain.ContractTemplate) error {
	const q = `
		INSERT INTO contract_template (language, pages, updated_by, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (language) DO UPDATE SET pages = $2, updated_by = $3, updated_at = now()
		RETURNING updated_at`
	return r.db.QueryRow(ctx, q, string(t.Language), t.Pages, t.UpdatedBy).Scan(&t.UpdatedAt)
}
