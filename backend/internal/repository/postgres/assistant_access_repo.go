package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type AssistantAccessRepo struct {
	db *pgxpool.Pool
}

func NewAssistantAccessRepo(db *pgxpool.Pool) *AssistantAccessRepo {
	return &AssistantAccessRepo{db: db}
}

func (r *AssistantAccessRepo) Get(ctx context.Context) (*domain.AssistantAccess, error) {
	a := &domain.AssistantAccess{}
	var audiences []string
	err := r.db.QueryRow(ctx, `SELECT audiences, updated_by, updated_at FROM assistant_access`).
		Scan(&audiences, &a.UpdatedBy, &a.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, repository.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	a.Audiences = make([]domain.AssistantAudience, 0, len(audiences))
	for _, s := range audiences {
		a.Audiences = append(a.Audiences, domain.AssistantAudience(s))
	}
	return a, nil
}

func (r *AssistantAccessRepo) Save(ctx context.Context, a *domain.AssistantAccess) error {
	audiences := make([]string, 0, len(a.Audiences))
	for _, s := range a.Audiences {
		audiences = append(audiences, string(s))
	}
	return r.db.QueryRow(ctx, `
		INSERT INTO assistant_access (audiences, updated_by, updated_at) VALUES ($1, $2, now())
		ON CONFLICT (singleton) DO UPDATE SET
			audiences = EXCLUDED.audiences, updated_by = EXCLUDED.updated_by, updated_at = now()
		RETURNING updated_at`, audiences, a.UpdatedBy).Scan(&a.UpdatedAt)
}
