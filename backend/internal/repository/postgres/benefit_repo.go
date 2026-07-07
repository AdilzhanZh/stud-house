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

type BenefitRepo struct {
	db *pgxpool.Pool
}

func NewBenefitRepo(db *pgxpool.Pool) *BenefitRepo {
	return &BenefitRepo{db: db}
}

func (r *BenefitRepo) Create(ctx context.Context, b *domain.Benefit) error {
	const q = `
		INSERT INTO benefits (name, description, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, q, b.Name, b.Description, b.CreatedBy).Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

func (r *BenefitRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Benefit, error) {
	const q = `SELECT id, name, description, created_by, created_at, updated_at FROM benefits WHERE id = $1`
	b := &domain.Benefit{}
	err := r.db.QueryRow(ctx, q, id).Scan(&b.ID, &b.Name, &b.Description, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return b, nil
}

func (r *BenefitRepo) List(ctx context.Context) ([]*domain.Benefit, error) {
	const q = `SELECT id, name, description, created_by, created_at, updated_at FROM benefits ORDER BY name`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Benefit
	for rows.Next() {
		b := &domain.Benefit{}
		if err := rows.Scan(&b.ID, &b.Name, &b.Description, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *BenefitRepo) Update(ctx context.Context, b *domain.Benefit) error {
	const q = `
		UPDATE benefits SET name = $2, description = $3, updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	err := r.db.QueryRow(ctx, q, b.ID, b.Name, b.Description).Scan(&b.UpdatedAt)
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

func (r *BenefitRepo) AddField(ctx context.Context, f *domain.BenefitField) error {
	const q = `
		INSERT INTO benefit_fields (benefit_id, field_name, field_type)
		VALUES ($1, $2, $3)
		RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, f.BenefitID, f.FieldName, f.FieldType).Scan(&f.ID, &f.CreatedAt)
}

func (r *BenefitRepo) ListFields(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitField, error) {
	const q = `SELECT id, benefit_id, field_name, field_type, created_at FROM benefit_fields WHERE benefit_id = $1 ORDER BY created_at`
	rows, err := r.db.Query(ctx, q, benefitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.BenefitField
	for rows.Next() {
		f := &domain.BenefitField{}
		if err := rows.Scan(&f.ID, &f.BenefitID, &f.FieldName, &f.FieldType, &f.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *BenefitRepo) DeleteField(ctx context.Context, fieldID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM benefit_fields WHERE id = $1`, fieldID)
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
		INSERT INTO benefit_required_documents (benefit_id, document_name)
		VALUES ($1, $2)
		RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, d.BenefitID, d.DocumentName).Scan(&d.ID, &d.CreatedAt)
}

func (r *BenefitRepo) ListRequiredDocuments(ctx context.Context, benefitID uuid.UUID) ([]*domain.BenefitRequiredDocument, error) {
	const q = `SELECT id, benefit_id, document_name, created_at FROM benefit_required_documents WHERE benefit_id = $1 ORDER BY created_at`
	rows, err := r.db.Query(ctx, q, benefitID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.BenefitRequiredDocument
	for rows.Next() {
		d := &domain.BenefitRequiredDocument{}
		if err := rows.Scan(&d.ID, &d.BenefitID, &d.DocumentName, &d.CreatedAt); err != nil {
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
