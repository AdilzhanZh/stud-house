package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type BenefitRepo struct {
	db *pgxpool.Pool
}

func NewBenefitRepo(db *pgxpool.Pool) *BenefitRepo {
	return &BenefitRepo{db: db}
}

func (r *BenefitRepo) Create(ctx context.Context, b *domain.Benefit) error {
	const q = `
		INSERT INTO benefits (name_kk, name_ru, description_kk, description_ru, priority, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, q, b.NameKk, b.NameRu, b.DescriptionKk, b.DescriptionRu, b.Priority, b.CreatedBy).
		Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

func (r *BenefitRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Benefit, error) {
	const q = `SELECT id, name_kk, name_ru, description_kk, description_ru, priority, created_by, created_at, updated_at FROM benefits WHERE id = $1`
	b := &domain.Benefit{}
	err := r.db.QueryRow(ctx, q, id).Scan(&b.ID, &b.NameKk, &b.NameRu, &b.DescriptionKk, &b.DescriptionRu, &b.Priority, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return b, nil
}

func (r *BenefitRepo) List(ctx context.Context) ([]*domain.Benefit, error) {
	const q = `SELECT id, name_kk, name_ru, description_kk, description_ru, priority, created_by, created_at, updated_at FROM benefits ORDER BY priority DESC, name_kk`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Benefit
	for rows.Next() {
		b := &domain.Benefit{}
		if err := rows.Scan(&b.ID, &b.NameKk, &b.NameRu, &b.DescriptionKk, &b.DescriptionRu, &b.Priority, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *BenefitRepo) Update(ctx context.Context, b *domain.Benefit) error {
	const q = `
		UPDATE benefits SET name_kk = $2, name_ru = $3, description_kk = $4, description_ru = $5, priority = $6, updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	err := r.db.QueryRow(ctx, q, b.ID, b.NameKk, b.NameRu, b.DescriptionKk, b.DescriptionRu, b.Priority).Scan(&b.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *BenefitRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM benefits WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *BenefitRepo) AddRequiredDocument(ctx context.Context, d *domain.BenefitRequiredDocument) error {
	const q = `
		INSERT INTO benefit_required_documents (benefit_id, document_id)
		VALUES ($1, $2)
		RETURNING id, created_at`
	err := r.db.QueryRow(ctx, q, d.BenefitID, d.DocumentID).Scan(&d.ID, &d.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23503" {
				return repository.ErrNotFound
			}
			if pgErr.Code == "23505" {
				return repository.ErrConflict
			}
		}
		return err
	}
	return nil
}

func (r *BenefitRepo) ListRequiredDocuments(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitRequiredDocument, error) {
	const q = `
		SELECT brd.id, brd.benefit_id, brd.document_id, rd.name_kk, rd.name_ru, brd.created_at
		FROM benefit_required_documents brd
		JOIN required_documents rd ON rd.id = brd.document_id
		WHERE brd.benefit_id = $1 ORDER BY brd.created_at`
	rows, err := r.db.Query(ctx, q, benefitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.BenefitRequiredDocument
	for rows.Next() {
		d := &domain.BenefitRequiredDocument{}
		if err := rows.Scan(&d.ID, &d.BenefitID, &d.DocumentID, &d.DocumentNameKk, &d.DocumentNameRu, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *BenefitRepo) DeleteRequiredDocument(ctx context.Context, docID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM benefit_required_documents WHERE id = $1`, docID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}
