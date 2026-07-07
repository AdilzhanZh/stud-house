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

type DormitoryRepo struct {
	db *pgxpool.Pool
}

func NewDormitoryRepo(db *pgxpool.Pool) *DormitoryRepo {
	return &DormitoryRepo{db: db}
}

func (r *DormitoryRepo) Create(ctx context.Context, d *domain.Dormitory) error {
	const q = `
		INSERT INTO dormitories (name, address, total_capacity, payment_qr_code_url, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, q, d.Name, d.Address, d.TotalCapacity, d.PaymentQRCodeURL, d.CreatedBy).
		Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
}

func (r *DormitoryRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Dormitory, error) {
	const q = `
		SELECT id, name, address, total_capacity, payment_qr_code_url, created_by, created_at, updated_at
		FROM dormitories WHERE id = $1`
	d := &domain.Dormitory{}
	err := r.db.QueryRow(ctx, q, id).Scan(&d.ID, &d.Name, &d.Address, &d.TotalCapacity, &d.PaymentQRCodeURL, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return d, nil
}

func (r *DormitoryRepo) List(ctx context.Context) ([]*domain.Dormitory, error) {
	const q = `
		SELECT id, name, address, total_capacity, payment_qr_code_url, created_by, created_at, updated_at
		FROM dormitories ORDER BY name`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Dormitory
	for rows.Next() {
		d := &domain.Dormitory{}
		if err := rows.Scan(&d.ID, &d.Name, &d.Address, &d.TotalCapacity, &d.PaymentQRCodeURL, &d.CreatedBy, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *DormitoryRepo) Update(ctx context.Context, d *domain.Dormitory) error {
	const q = `
		UPDATE dormitories
		SET name = $2, address = $3, total_capacity = $4, payment_qr_code_url = $5, updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	err := r.db.QueryRow(ctx, q, d.ID, d.Name, d.Address, d.TotalCapacity, d.PaymentQRCodeURL).Scan(&d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}
	return nil
}

func (r *DormitoryRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM dormitories WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// GetCapacity returns total_capacity alongside the sum of all room capacities
// currently provisioned in the dormitory (the "жиналған орын саны" progress figure).
func (r *DormitoryRepo) GetCapacity(ctx context.Context, id uuid.UUID) (*domain.DormitoryCapacity, error) {
	const q = `
		SELECT d.id, d.total_capacity, COALESCE(SUM(r.capacity), 0)
		FROM dormitories d
		LEFT JOIN rooms r ON r.dormitory_id = d.id
		WHERE d.id = $1
		GROUP BY d.id, d.total_capacity`
	c := &domain.DormitoryCapacity{}
	err := r.db.QueryRow(ctx, q, id).Scan(&c.DormitoryID, &c.TotalCapacity, &c.AllocatedBeds)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func (r *DormitoryRepo) AddImage(ctx context.Context, img *domain.DormitoryImage) error {
	const q = `INSERT INTO dormitory_images (dormitory_id, image_url) VALUES ($1, $2) RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, img.DormitoryID, img.ImageURL).Scan(&img.ID, &img.CreatedAt)
}

func (r *DormitoryRepo) ListImages(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryImage, error) {
	const q = `SELECT id, dormitory_id, image_url, created_at FROM dormitory_images WHERE dormitory_id = $1 ORDER BY created_at`
	rows, err := r.db.Query(ctx, q, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.DormitoryImage
	for rows.Next() {
		img := &domain.DormitoryImage{}
		if err := rows.Scan(&img.ID, &img.DormitoryID, &img.ImageURL, &img.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, img)
	}
	return out, rows.Err()
}

func (r *DormitoryRepo) DeleteImage(ctx context.Context, imageID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM dormitory_images WHERE id = $1`, imageID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}
