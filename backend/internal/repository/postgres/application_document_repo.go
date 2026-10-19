package postgres

import (
	"context"
	"errors"
	"time"

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
		INSERT INTO application_documents (application_id, benefit_required_document_id, dormitory_required_document_id, document_name, file_url, ai_status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, uploaded_at`
	if d.CheckStatus == "" {
		d.CheckStatus = domain.DocumentCheckSkipped
	}
	err := r.db.QueryRow(ctx, q, d.ApplicationID, d.BenefitRequiredDocumentID, d.DormitoryRequiredDocumentID, d.DocumentName, d.FileURL, string(d.CheckStatus)).Scan(&d.ID, &d.UploadedAt)
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
			COALESCE(ad.document_name, brd_doc.name_ru, drd_doc.name_ru, '') AS display_name_ru,
			ad.ai_status, ad.ai_result, ad.ai_error
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
		var status string
		if err := rows.Scan(&d.ID, &d.ApplicationID, &d.BenefitRequiredDocumentID, &d.DormitoryRequiredDocumentID, &d.DocumentName, &d.FileURL, &d.UploadedAt, &d.DisplayNameKk, &d.DisplayNameRu, &status, &d.CheckResult, &d.CheckError); err != nil {
			return nil, err
		}
		d.CheckStatus = domain.DocumentCheckStatus(status)
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

func (r *ApplicationDocumentRepo) ClaimPendingChecks(ctx context.Context, limit int) ([]*domain.PendingDocumentCheck, error) {
	const q = `
		WITH claimed AS (
			UPDATE application_documents
			SET ai_status = 'processing', ai_claimed_at = now(), ai_attempts = ai_attempts + 1
			WHERE id IN (
				SELECT id FROM application_documents
				WHERE ai_status = 'pending'
				ORDER BY uploaded_at
				LIMIT $1
				FOR UPDATE SKIP LOCKED
			)
			RETURNING id, application_id, benefit_required_document_id, dormitory_required_document_id, file_url, ai_attempts
		)
		SELECT c.id, c.file_url, c.ai_attempts,
			COALESCE(brd_doc.name_kk, drd_doc.name_kk, ''),
			COALESCE(brd_doc.name_ru, drd_doc.name_ru, ''),
			u.full_name
		FROM claimed c
		JOIN applications a ON a.id = c.application_id
		JOIN users u ON u.id = a.student_id
		LEFT JOIN benefit_required_documents brd ON brd.id = c.benefit_required_document_id
		LEFT JOIN required_documents brd_doc ON brd_doc.id = brd.document_id
		LEFT JOIN dormitory_required_documents drd ON drd.id = c.dormitory_required_document_id
		LEFT JOIN required_documents drd_doc ON drd_doc.id = drd.document_id`
	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.PendingDocumentCheck
	for rows.Next() {
		p := &domain.PendingDocumentCheck{}
		if err := rows.Scan(&p.DocumentID, &p.FileURL, &p.Attempts, &p.ExpectedNameKk, &p.ExpectedNameRu, &p.StudentFullName); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *ApplicationDocumentRepo) FinishCheck(ctx context.Context, documentID uuid.UUID, status domain.DocumentCheckStatus, result *domain.DocumentCheckResult, errMsg *string) error {
	const q = `
		UPDATE application_documents
		SET ai_status = $2::text, ai_result = $3, ai_error = $4, ai_claimed_at = NULL,
			ai_checked_at = CASE WHEN $2::text = 'pending' THEN ai_checked_at ELSE now() END
		WHERE id = $1`
	_, err := r.db.Exec(ctx, q, documentID, string(status), result, errMsg)
	return err
}

func (r *ApplicationDocumentRepo) RequeueStaleChecks(ctx context.Context, cutoff time.Time) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE application_documents SET ai_status = 'pending', ai_claimed_at = NULL
		WHERE ai_status = 'processing' AND ai_claimed_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *ApplicationDocumentRepo) ListLatestChecks(ctx context.Context, applicationIDs []uuid.UUID) ([]*domain.DocumentCheck, error) {
	if len(applicationIDs) == 0 {
		return nil, nil
	}
	const q = `
		SELECT DISTINCT ON (ad.application_id, ad.benefit_required_document_id, ad.dormitory_required_document_id)
			ad.application_id, ad.id, ad.benefit_required_document_id, ad.dormitory_required_document_id,
			rd.name_kk, rd.name_ru, rd.validity_days, ad.ai_status, ad.ai_result, COALESCE(ad.ai_error, '')
		FROM application_documents ad
		LEFT JOIN benefit_required_documents brd ON brd.id = ad.benefit_required_document_id
		LEFT JOIN dormitory_required_documents drd ON drd.id = ad.dormitory_required_document_id
		JOIN required_documents rd ON rd.id = COALESCE(brd.document_id, drd.document_id)
		WHERE ad.application_id = ANY($1)
		ORDER BY ad.application_id, ad.benefit_required_document_id, ad.dormitory_required_document_id, ad.uploaded_at DESC`
	rows, err := r.db.Query(ctx, q, applicationIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.DocumentCheck
	for rows.Next() {
		c := &domain.DocumentCheck{}
		var status string
		if err := rows.Scan(&c.ApplicationID, &c.DocumentID, &c.BenefitRequiredDocumentID, &c.DormitoryRequiredDocumentID, &c.NameKk, &c.NameRu, &c.ValidityDays, &status, &c.Result, &c.Error); err != nil {
			return nil, err
		}
		c.Status = domain.DocumentCheckStatus(status)
		out = append(out, c)
	}
	return out, rows.Err()
}
