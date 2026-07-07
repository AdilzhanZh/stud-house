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

type ApplicationDocumentRepo struct {
	db *pgxpool.Pool
}

func NewApplicationDocumentRepo(db *pgxpool.Pool) *ApplicationDocumentRepo {
	return &ApplicationDocumentRepo{db: db}
}

func (r *ApplicationDocumentRepo) Add(ctx context.Context, d *domain.ApplicationDocument) error {
	const q = `
		INSERT INTO application_documents (application_id, benefit_required_document_id, document_name, file_url)
		VALUES ($1, $2, $3, $4)
		RETURNING id, uploaded_at`
	err := r.db.QueryRow(ctx, q, d.ApplicationID, d.BenefitRequiredDocumentID, d.DocumentName, d.FileURL).Scan(&d.ID, &d.UploadedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return repository.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *ApplicationDocumentRepo) ListByApplication(ctx context.Context, applicationID uuid.UUID) ([]*domain.ApplicationDocument, error) {
	const q = `
		SELECT id, application_id, benefit_required_document_id, document_name, file_url, uploaded_at
		FROM application_documents WHERE application_id = $1 ORDER BY uploaded_at`
	rows, err := r.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.ApplicationDocument
	for rows.Next() {
		d := &domain.ApplicationDocument{}
		if err := rows.Scan(&d.ID, &d.ApplicationID, &d.BenefitRequiredDocumentID, &d.DocumentName, &d.FileURL, &d.UploadedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
