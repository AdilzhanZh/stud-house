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

// HierarchyRepo stores the registry levels around a dormitory (корпус):
// objects above it and floors below it (see migration 000099).
type HierarchyRepo struct {
	db *pgxpool.Pool
}

func NewHierarchyRepo(db *pgxpool.Pool) *HierarchyRepo {
	return &HierarchyRepo{db: db}
}

func uniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

const objectSelect = `
	SELECT o.id, o.name, o.owner_name, o.bin, o.ownership_form, o.phone, o.created_at, o.updated_at,
		(SELECT count(*) FROM dormitories d WHERE d.object_id = o.id)
	FROM dorm_objects o`

func scanObject(row pgx.Row) (*domain.DormObject, error) {
	o := &domain.DormObject{}
	err := row.Scan(&o.ID, &o.Name, &o.OwnerName, &o.BIN, &o.OwnershipForm, &o.Phone,
		&o.CreatedAt, &o.UpdatedAt, &o.DormitoryCount)
	if err != nil {
		return nil, err
	}
	return o, nil
}

func (r *HierarchyRepo) ListObjects(ctx context.Context) ([]*domain.DormObject, error) {
	rows, err := r.db.Query(ctx, objectSelect+` ORDER BY o.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.DormObject
	for rows.Next() {
		o, err := scanObject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (r *HierarchyRepo) GetObject(ctx context.Context, id uuid.UUID) (*domain.DormObject, error) {
	o, err := scanObject(r.db.QueryRow(ctx, objectSelect+` WHERE o.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, repository.ErrNotFound
	}
	return o, err
}

func (r *HierarchyRepo) CreateObject(ctx context.Context, o *domain.DormObject) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO dorm_objects (name, owner_name, bin, ownership_form, phone)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`,
		o.Name, o.OwnerName, o.BIN, o.OwnershipForm, o.Phone,
	).Scan(&o.ID, &o.CreatedAt, &o.UpdatedAt)
	if uniqueViolation(err) {
		return repository.ErrConflict
	}
	return err
}

func (r *HierarchyRepo) UpdateObject(ctx context.Context, o *domain.DormObject) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE dorm_objects
		SET name = $2, owner_name = $3, bin = $4, ownership_form = $5, phone = $6, updated_at = now()
		WHERE id = $1`,
		o.ID, o.Name, o.OwnerName, o.BIN, o.OwnershipForm, o.Phone)
	if uniqueViolation(err) {
		return repository.ErrConflict
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// DeleteObject removes an object with no buildings. ErrNotEmpty otherwise.
func (r *HierarchyRepo) DeleteObject(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM dorm_objects WHERE id = $1`, id)
	if foreignKeyViolation(err) {
		return repository.ErrNotEmpty
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// MoveDormitories moves the buildings into the object in one transaction;
// the dormitories_drop_empty_object trigger removes objects left empty.
func (r *HierarchyRepo) MoveDormitories(ctx context.Context, objectID uuid.UUID, dormitoryIDs []uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Lock the target so a concurrent delete can't remove it mid-move.
	var locked uuid.UUID
	err = tx.QueryRow(ctx, `SELECT id FROM dorm_objects WHERE id = $1 FOR UPDATE`, objectID).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return repository.ErrNotFound
	}
	if err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE dormitories SET object_id = $1, updated_at = now()
		WHERE id = ANY($2) AND object_id <> $1`, objectID, dormitoryIDs); err != nil {
		return err
	}
	var found int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM dormitories WHERE id = ANY($1)`, dormitoryIDs).Scan(&found); err != nil {
		return err
	}
	if found != len(dormitoryIDs) {
		return repository.ErrNotFound
	}
	return tx.Commit(ctx)
}

const floorSelect = `
	SELECT f.id, f.dormitory_id, f.number, f.name, f.created_at, f.retired_at,
		(SELECT count(*) FROM rooms r WHERE r.floor_id = f.id)
	FROM floors f`

const floorOrder = `(f.retired_at IS NOT NULL), f.number NULLS LAST, f.created_at`

func scanFloor(row pgx.Row) (*domain.Floor, error) {
	f := &domain.Floor{}
	err := row.Scan(&f.ID, &f.DormitoryID, &f.Number, &f.Name, &f.CreatedAt, &f.RetiredAt, &f.RoomCount)
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (r *HierarchyRepo) ListFloors(ctx context.Context, dormitoryID uuid.UUID, includeRetired bool) ([]*domain.Floor, error) {
	rows, err := r.db.Query(ctx, floorSelect+`
		WHERE f.dormitory_id = $1 AND ($2 OR f.retired_at IS NULL)
		ORDER BY `+floorOrder, dormitoryID, includeRetired)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.Floor
	for rows.Next() {
		f, err := scanFloor(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *HierarchyRepo) GetFloor(ctx context.Context, id uuid.UUID) (*domain.Floor, error) {
	f, err := scanFloor(r.db.QueryRow(ctx, floorSelect+` WHERE f.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, repository.ErrNotFound
	}
	return f, err
}

// FindActiveFloor finds the dormitory's active floor with that number
// (nil number = the "not set" floor).
func (r *HierarchyRepo) FindActiveFloor(ctx context.Context, dormitoryID uuid.UUID, number *int) (*domain.Floor, error) {
	f, err := scanFloor(r.db.QueryRow(ctx, floorSelect+`
		WHERE f.dormitory_id = $1 AND f.number IS NOT DISTINCT FROM $2 AND f.retired_at IS NULL`,
		dormitoryID, number))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, repository.ErrNotFound
	}
	return f, err
}

// CreateFloor adds a floor to a dormitory. ErrConflict if it already has an
// active floor with that number, ErrNotFound if the dormitory is missing.
func (r *HierarchyRepo) CreateFloor(ctx context.Context, f *domain.Floor) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO floors (dormitory_id, number, name) VALUES ($1, $2, $3)
		RETURNING id, created_at`,
		f.DormitoryID, f.Number, f.Name,
	).Scan(&f.ID, &f.CreatedAt)
	if uniqueViolation(err) {
		return repository.ErrConflict
	}
	if foreignKeyViolation(err) {
		return repository.ErrNotFound
	}
	return err
}

// UpdateFloor renumbers/renames an active floor; its rooms follow
// automatically (trigger floors_sync_rooms).
func (r *HierarchyRepo) UpdateFloor(ctx context.Context, f *domain.Floor) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE floors SET number = $2, name = $3 WHERE id = $1 AND retired_at IS NULL`,
		f.ID, f.Number, f.Name)
	if uniqueViolation(err) {
		return repository.ErrConflict
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// RetireFloor retires an empty floor. ErrNotEmpty if rooms are still on it,
// ErrNotFound if missing or already retired.
func (r *HierarchyRepo) RetireFloor(ctx context.Context, id uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var locked uuid.UUID
	err = tx.QueryRow(ctx, `SELECT id FROM floors WHERE id = $1 AND retired_at IS NULL FOR UPDATE`, id).Scan(&locked)
	if errors.Is(err, pgx.ErrNoRows) {
		return repository.ErrNotFound
	}
	if err != nil {
		return err
	}
	var rooms int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM rooms WHERE floor_id = $1`, id).Scan(&rooms); err != nil {
		return err
	}
	if rooms > 0 {
		return repository.ErrNotEmpty
	}
	if _, err := tx.Exec(ctx, `UPDATE floors SET retired_at = now() WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Registry returns the whole hierarchy as flat rows, one per bed, with
// empty buildings/floors/rooms kept as rows whose lower levels are nil.
// Retired floors and beds are left out. objectID / dormitoryID narrow it.
func (r *HierarchyRepo) Registry(ctx context.Context, objectID, dormitoryID *uuid.UUID) ([]*domain.RegistryRow, error) {
	const q = `
		SELECT o.id, o.name, o.owner_name, o.ownership_form,
			d.id, d.name, COALESCE(d.address, ''),
			f.id, f.number, f.name,
			r.id, r.room_number, r.capacity,
			bd.id, bd.inventory_no, bd.label,
			(bd.id IS NOT NULL AND EXISTS (SELECT 1 FROM room_residents rr
				WHERE rr.bed_id = bd.id AND rr.moved_out_at IS NULL))
		FROM dorm_objects o
		JOIN dormitories d ON d.object_id = o.id
		LEFT JOIN floors f ON f.dormitory_id = d.id AND f.retired_at IS NULL
		LEFT JOIN rooms r ON r.floor_id = f.id
		LEFT JOIN beds bd ON bd.room_id = r.id AND bd.retired_at IS NULL
		WHERE ($1::uuid IS NULL OR o.id = $1) AND ($2::uuid IS NULL OR d.id = $2)
		ORDER BY o.name, o.id, d.name, d.id, f.number NULLS LAST, f.id,
			(r.room_number ~ '^[0-9]{1,9}$') DESC,
			CASE WHEN r.room_number ~ '^[0-9]{1,9}$' THEN r.room_number::int END, r.room_number, r.id,
			(bd.label ~ '^[0-9]{1,9}$') DESC,
			CASE WHEN bd.label ~ '^[0-9]{1,9}$' THEN bd.label::int END, bd.label, bd.inventory_no`
	rows, err := r.db.Query(ctx, q, objectID, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.RegistryRow
	for rows.Next() {
		x := &domain.RegistryRow{}
		if err := rows.Scan(
			&x.ObjectID, &x.ObjectName, &x.OwnerName, &x.OwnershipForm,
			&x.DormitoryID, &x.DormitoryName, &x.DormitoryAddress,
			&x.FloorID, &x.FloorNumber, &x.FloorName,
			&x.RoomID, &x.RoomNumber, &x.RoomCapacity,
			&x.BedID, &x.BedInventoryNo, &x.BedLabel, &x.BedOccupied,
		); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}
