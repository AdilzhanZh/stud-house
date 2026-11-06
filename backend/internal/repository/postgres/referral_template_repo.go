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

// referralTemplateID is the fixed row id enforced by the
// referral_template_singleton CHECK constraint.
var referralTemplateID = uuid.MustParse("00000000-0000-0000-0000-000000000006")

type ReferralTemplateRepo struct {
	db *pgxpool.Pool
}

func NewReferralTemplateRepo(db *pgxpool.Pool) *ReferralTemplateRepo {
	return &ReferralTemplateRepo{db: db}
}

func (r *ReferralTemplateRepo) Get(ctx context.Context) (*domain.ReferralTemplate, error) {
	const q = `SELECT id, pages, updated_by, updated_at FROM referral_template WHERE id = $1`
	t := &domain.ReferralTemplate{}
	err := r.db.QueryRow(ctx, q, referralTemplateID).Scan(&t.ID, &t.Pages, &t.UpdatedBy, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *ReferralTemplateRepo) Upsert(ctx context.Context, t *domain.ReferralTemplate) error {
	const q = `
		INSERT INTO referral_template (id, pages, updated_by, updated_at)
		VALUES ($1, $2, $3, now())
		ON CONFLICT (id) DO UPDATE SET pages = $2, updated_by = $3, updated_at = now()
		RETURNING updated_at`
	t.ID = referralTemplateID
	return r.db.QueryRow(ctx, q, referralTemplateID, t.Pages, t.UpdatedBy).Scan(&t.UpdatedAt)
}
