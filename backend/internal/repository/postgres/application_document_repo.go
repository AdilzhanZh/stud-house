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
		INSERT INTO application_documents (application_id, benefit_required_document_id, dormitory_required_document_id, document_name, file_url)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, uploaded_at`
	err := r.db.QueryRow(ctx, q, d.ApplicationID, d.BenefitRequiredDocumentID, d.DormitoryRequiredDocumentID, d.DocumentName, d.FileURL).Scan(&d.ID, &d.UploadedAt)
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
		SELECT
			ad.id, ad.application_id, ad.benefit_required_document_id, ad.dormitory_required_document_id,
			ad.document_name, ad.file_url, ad.uploaded_at,
			COALESCE(ad.document_name, brd_doc.name_kk, drd_doc.name_kk, '') AS display_name_kk,
			COALESCE(ad.document_name, brd_doc.name_ru, drd_doc.name_ru, '') AS display_name_ru
		FROM application_documents ad
		LEFT JOIN benefit_required_documents brd ON brd.id = ad.benefit_required_document_id
		LEFT JOIN required_documents brd_doc ON brd_doc.id = brd.document_id
		LEFT JOIN dormitory_required_documents drd ON drd.id = ad.dormitory_required_document_id
		LEFT JOIN required_documents drd_doc ON drd_doc.id = drd.document_id
		WHERE ad.application_id = $1 ORDER BY ad.uploaded_at`
	rows, err := r.db.Query(ctx, q, applicationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.ApplicationDocument
	for rows.Next() {
		d := &domain.ApplicationDocument{}
		if err := rows.Scan(&d.ID, &d.ApplicationID, &d.BenefitRequiredDocumentID, &d.DormitoryRequiredDocumentID, &d.DocumentName, &d.FileURL, &d.UploadedAt, &d.DisplayNameKk, &d.DisplayNameRu); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *ApplicationDocumentRepo) ListMissingRequired(ctx context.Context, applicationIDs []uuid.UUID) ([]*domain.MissingRequiredDocument, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `
		SELECT a.id, NULL::uuid, drd.id, rd.name_kk, rd.name_ru
		FROM applications a
		JOIN dormitory_required_documents drd ON drd.dormitory_id = a.dormitory_id
		JOIN required_documents rd ON rd.id = drd.document_id
		WHERE a.id = ANY($1)
			AND NOT EXISTS (
				SELECT 1 FROM application_documents ad
				WHERE ad.application_id = a.id AND ad.dormitory_required_document_id = drd.id
			)
		UNION ALL
		SELECT a.id, brd.id, NULL::uuid, rd.name_kk, rd.name_ru
		FROM applications a
		JOIN student_benefits sb ON sb.student_id = a.student_id
		JOIN benefit_required_documents brd ON brd.benefit_id = sb.benefit_id
		JOIN required_documents rd ON rd.id = brd.document_id
		WHERE a.id = ANY($1)
			AND NOT EXISTS (
				SELECT 1 FROM application_documents ad
				WHERE ad.application_id = a.id AND ad.benefit_required_document_id = brd.id
			)
		ORDER BY 1, 4`
	rows, err := r.db.Query(ctx, q, applicationIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.MissingRequiredDocument
	for rows.Next() {
		m := &domain.MissingRequiredDocument{}
		if err := rows.Scan(&m.ApplicationID, &m.BenefitRequiredDocumentID, &m.DormitoryRequiredDocumentID, &m.NameKk, &m.NameRu); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}
