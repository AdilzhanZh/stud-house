package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type AISettingsRepo struct {
	db *pgxpool.Pool
}

func NewAISettingsRepo(db *pgxpool.Pool) *AISettingsRepo {
	return &AISettingsRepo{db: db}
}

func (r *AISettingsRepo) Get(ctx context.Context) (*domain.AISettings, error) {
	s := &domain.AISettings{}
	err := r.db.QueryRow(ctx, `
		SELECT assistant_enabled, assistant_model, assistant_effort, assistant_daily_limit,
			document_checks_enabled, document_check_model, updated_by, updated_at
		FROM ai_settings`).Scan(&s.AssistantEnabled, &s.AssistantModel, &s.AssistantEffort, &s.AssistantDailyLimit,
		&s.DocumentChecksEnabled, &s.DocumentCheckModel, &s.UpdatedBy, &s.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, repository.ErrNotFound
	}
	return s, err
}

func (r *AISettingsRepo) Save(ctx context.Context, s *domain.AISettings) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO ai_settings (assistant_enabled, assistant_model, assistant_effort, assistant_daily_limit,
			document_checks_enabled, document_check_model, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
		ON CONFLICT (singleton) DO UPDATE SET
			assistant_enabled = EXCLUDED.assistant_enabled,
			assistant_model = EXCLUDED.assistant_model,
			assistant_effort = EXCLUDED.assistant_effort,
			assistant_daily_limit = EXCLUDED.assistant_daily_limit,
			document_checks_enabled = EXCLUDED.document_checks_enabled,
			document_check_model = EXCLUDED.document_check_model,
			updated_by = EXCLUDED.updated_by,
			updated_at = now()
		RETURNING updated_at`,
		s.AssistantEnabled, s.AssistantModel, s.AssistantEffort, s.AssistantDailyLimit,
		s.DocumentChecksEnabled, s.DocumentCheckModel, s.UpdatedBy).Scan(&s.UpdatedAt)
}
