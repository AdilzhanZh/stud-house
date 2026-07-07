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

type ReportTemplateRepo struct {
	db *pgxpool.Pool
}

func NewReportTemplateRepo(db *pgxpool.Pool) *ReportTemplateRepo {
	return &ReportTemplateRepo{db: db}
}

func (r *ReportTemplateRepo) Create(ctx context.Context, t *domain.ReportTemplate) error {
	const q = `
		INSERT INTO report_templates (name, file_url, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, t.Name, t.FileURL, t.CreatedBy).Scan(&t.ID, &t.CreatedAt)
}

func (r *ReportTemplateRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.ReportTemplate, error) {
	const q = `SELECT id, name, file_url, created_by, created_at FROM report_templates WHERE id = $1`
	t := &domain.ReportTemplate{}
	err := r.db.QueryRow(ctx, q, id).Scan(&t.ID, &t.Name, &t.FileURL, &t.CreatedBy, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *ReportTemplateRepo) List(ctx context.Context) ([]*domain.ReportTemplate, error) {
	const q = `SELECT id, name, file_url, created_by, created_at FROM report_templates ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.ReportTemplate
	for rows.Next() {
		t := &domain.ReportTemplate{}
		if err := rows.Scan(&t.ID, &t.Name, &t.FileURL, &t.CreatedBy, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
