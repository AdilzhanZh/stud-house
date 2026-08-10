package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

// protocolTemplateID is the fixed row id enforced by the
// protocol_template_singleton CHECK constraint — there is only ever one row.
// Deliberately different from petitionTemplateID so the two singletons can
// never collide.
var protocolTemplateID = uuid.MustParse("00000000-0000-0000-0000-000000000002")

type ProtocolTemplateRepo struct {
	db *pgxpool.Pool
}

func NewProtocolTemplateRepo(db *pgxpool.Pool) *ProtocolTemplateRepo {
	return &ProtocolTemplateRepo{db: db}
}

func (r *ProtocolTemplateRepo) Get(ctx context.Context) (*domain.ProtocolTemplate, error) {
	const q = `SELECT id, pages, updated_by, updated_at FROM protocol_template WHERE id = $1`
	t := &domain.ProtocolTemplate{}
	err := r.db.QueryRow(ctx, q, protocolTemplateID).Scan(&t.ID, &t.Pages, &t.UpdatedBy, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *ProtocolTemplateRepo) Upsert(ctx context.Context, t *domain.ProtocolTemplate) error {
	const q = `
		INSERT INTO protocol_template (id, pages, updated_by, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (id) DO UPDATE SET pages = $2, updated_by = $3, updated_at = now()
		RETURNING updated_at`
	t.ID = protocolTemplateID
	return r.db.QueryRow(ctx, q, protocolTemplateID, t.Pages, t.UpdatedBy).Scan(&t.UpdatedAt)
}
