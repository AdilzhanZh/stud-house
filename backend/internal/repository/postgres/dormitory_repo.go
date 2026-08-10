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

type DormitoryRepo struct {
	db *pgxpool.Pool
}

func NewDormitoryRepo(db *pgxpool.Pool) *DormitoryRepo {
	return &DormitoryRepo{db: db}
}

const dormitoryColumns = `
	id, name, address, phone, dorm_type, floor_count, total_rooms_target,
	total_capacity, rooms_male, rooms_female, rooms_mixed,
	monthly_payment, yearly_payment, built_year,
	commissioned_year, ownership_form, closed_for_applications,
	created_by, created_at, updated_at`

// dormTypeToText/textToDormType convert domain.DormitoryType (a named string
// type) to/from a plain *string at the pgx boundary — mirrors the
// string(u.Role) convention used elsewhere in this package for enum columns;
// pgx doesn't know how to encode/decode a pointer to a custom named type.
func dormTypeToText(t *domain.DormitoryType) *string {
	if t == nil {
		return nil
	}
	s := string(*t)
	return &s
}

func textToDormType(s *string) *domain.DormitoryType {
	if s == nil {
		return nil
	}
	t := domain.DormitoryType(*s)
	return &t
}

func scanDormitory(row pgx.Row) (*domain.Dormitory, error) {
	d := &domain.Dormitory{}
	var dormType *string
	err := row.Scan(
		&d.ID, &d.Name, &d.Address, &d.Phone, &dormType, &d.FloorCount, &d.TotalRoomsTarget,
		&d.TotalCapacity, &d.RoomsMale, &d.RoomsFemale, &d.RoomsMixed,
		&d.MonthlyPayment, &d.YearlyPayment, &d.BuiltYear,
		&d.CommissionedYear, &d.OwnershipForm, &d.ClosedForApplications,
		&d.CreatedBy, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	d.Type = textToDormType(dormType)
	return d, nil
}

func (r *DormitoryRepo) Create(ctx context.Context, d *domain.Dormitory) error {
	const q = `
		INSERT INTO dormitories (
			name, address, phone, dorm_type, floor_count, total_rooms_target,
			total_capacity, rooms_male, rooms_female, rooms_mixed,
			monthly_payment, yearly_payment, built_year,
			commissioned_year, ownership_form, closed_for_applications, created_by
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, q,
		d.Name, d.Address, d.Phone, dormTypeToText(d.Type), d.FloorCount, d.TotalRoomsTarget,
		d.TotalCapacity, d.RoomsMale, d.RoomsFemale, d.RoomsMixed,
		d.MonthlyPayment, d.YearlyPayment, d.BuiltYear,
		d.CommissionedYear, d.OwnershipForm, d.ClosedForApplications, d.CreatedBy,
	).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
}

func (r *DormitoryRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Dormitory, error) {
	q := `SELECT ` + dormitoryColumns + ` FROM dormitories WHERE id = $1`
	d, err := scanDormitory(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return d, nil
}

// List returns every dormitory when openOnly is false (admin management,
// and any lookup that must still resolve a closed dormitory's name for
// existing residents/applications). When openOnly is true it excludes
// dormitories closed for applications — used by the student browse/apply list.
func (r *DormitoryRepo) List(ctx context.Context, openOnly bool) ([]*domain.Dormitory, error) {
	q := `SELECT ` + dormitoryColumns + ` FROM dormitories`
	if openOnly {
		q += ` WHERE closed_for_applications = false`
	}
	q += ` ORDER BY name`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Dormitory
	for rows.Next() {
		d, err := scanDormitory(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// Update returns repository.ErrNotFound if the dormitory doesn't exist.
func (r *DormitoryRepo) Update(ctx context.Context, d *domain.Dormitory) error {
	const q = `
		UPDATE dormitories
		SET name = $2, address = $3, phone = $4, dorm_type = $5, floor_count = $6,
			total_rooms_target = $7, total_capacity = $8, rooms_male = $9,
			rooms_female = $10, rooms_mixed = $11, monthly_payment = $12,
			yearly_payment = $13, built_year = $14, commissioned_year = $15,
			ownership_form = $16, closed_for_applications = $17,
			updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	err := r.db.QueryRow(ctx, q,
		d.ID, d.Name, d.Address, d.Phone, dormTypeToText(d.Type), d.FloorCount,
		d.TotalRoomsTarget, d.TotalCapacity, d.RoomsMale, d.RoomsFemale, d.RoomsMixed,
		d.MonthlyPayment, d.YearlyPayment,
		d.BuiltYear, d.CommissionedYear, d.OwnershipForm, d.ClosedForApplications,
	).Scan(&d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}
	return nil
}

// Delete returns repository.ErrConflict if the dormitory is still referenced
// by an application (applications.dormitory_id has no ON DELETE clause, so
// Postgres rejects the delete with a foreign_key_violation). Rooms and images
// cascade automatically.
func (r *DormitoryRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM dormitories WHERE id = $1`, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return repository.ErrConflict
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// GetCapacity returns total_capacity alongside the sum of all room capacities
// currently provisioned in the dormitory (the "жиналған орын саны" progress
// figure), and total_rooms_target alongside how many rooms actually exist yet.
func (r *DormitoryRepo) GetCapacity(ctx context.Context, id uuid.UUID) (*domain.DormitoryCapacity, error) {
	const q = `
		SELECT d.id, d.total_capacity, COALESCE(SUM(r.capacity), 0), d.total_rooms_target, COUNT(r.id)
		FROM dormitories d
		LEFT JOIN rooms r ON r.dormitory_id = d.id
		WHERE d.id = $1
		GROUP BY d.id, d.total_capacity, d.total_rooms_target`
	c := &domain.DormitoryCapacity{}
	err := r.db.QueryRow(ctx, q, id).Scan(&c.DormitoryID, &c.TotalCapacity, &c.AllocatedBeds, &c.TotalRoomsTarget, &c.RoomsCreated)
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

func (r *DormitoryRepo) AddRequiredDocument(ctx context.Context, d *domain.DormitoryRequiredDocument) error {
	const q = `
		INSERT INTO dormitory_required_documents (dormitory_id, document_id)
		VALUES ($1, $2)
		RETURNING id, created_at`
	err := r.db.QueryRow(ctx, q, d.DormitoryID, d.DocumentID).Scan(&d.ID, &d.CreatedAt)
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

func (r *DormitoryRepo) ListRequiredDocuments(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.DormitoryRequiredDocument, error) {
	const q = `
		SELECT drd.id, drd.dormitory_id, drd.document_id, rd.name, drd.created_at
		FROM dormitory_required_documents drd
		JOIN required_documents rd ON rd.id = drd.document_id
		WHERE drd.dormitory_id = $1 ORDER BY drd.created_at`
	rows, err := r.db.Query(ctx, q, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.DormitoryRequiredDocument
	for rows.Next() {
		d := &domain.DormitoryRequiredDocument{}
		if err := rows.Scan(&d.ID, &d.DormitoryID, &d.DocumentID, &d.DocumentName, &d.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *DormitoryRepo) DeleteRequiredDocument(ctx context.Context, docID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM dormitory_required_documents WHERE id = $1`, docID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}
