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

// petitionTemplateID is the fixed row id enforced by the
// petition_template_singleton CHECK constraint — there is only ever one row.
var petitionTemplateID = uuid.MustParse("00000000-0000-0000-0000-000000000001")

type PetitionTemplateRepo struct {
	db *pgxpool.Pool
}

func NewPetitionTemplateRepo(db *pgxpool.Pool) *PetitionTemplateRepo {
	return &PetitionTemplateRepo{db: db}
}

func (r *PetitionTemplateRepo) Get(ctx context.Context) (*domain.PetitionTemplate, error) {
	const q = `SELECT id, pages, updated_by, updated_at FROM petition_template WHERE id = $1`
	t := &domain.PetitionTemplate{}
	err := r.db.QueryRow(ctx, q, petitionTemplateID).Scan(&t.ID, &t.Pages, &t.UpdatedBy, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *PetitionTemplateRepo) Upsert(ctx context.Context, t *domain.PetitionTemplate) error {
	const q = `
		INSERT INTO petition_template (id, pages, updated_by, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (id) DO UPDATE SET pages = $2, updated_by = $3, updated_at = now()
		RETURNING updated_at`
	t.ID = petitionTemplateID
	return r.db.QueryRow(ctx, q, petitionTemplateID, t.Pages, t.UpdatedBy).Scan(&t.UpdatedAt)
}
