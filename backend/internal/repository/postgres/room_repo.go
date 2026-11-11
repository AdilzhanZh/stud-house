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

type RoomRepo struct {
	db *pgxpool.Pool
}

func NewRoomRepo(db *pgxpool.Pool) *RoomRepo {
	return &RoomRepo{db: db}
}

// roomColumns must be selected FROM rooms without an alias (the floor name
// is correlated on rooms.floor_id).
const roomColumns = `id, dormitory_id, floor_id,
	(SELECT name FROM floors WHERE floors.id = rooms.floor_id),
	room_number, capacity, floor, category, restrictions,
	area_sq_m::float8, equipment, sanitary_conditions, is_accessible, accessibility_notes, photo_urls,
	created_at, updated_at`

// roomOrder lists rooms floor by floor.
const roomOrder = `floor NULLS LAST, room_number`

func scanRoom(row pgx.Row) (*domain.Room, error) {
	room := &domain.Room{}
	err := row.Scan(
		&room.ID, &room.DormitoryID, &room.FloorID, &room.FloorName,
		&room.RoomNumber, &room.Capacity, &room.Floor,
		&room.Category, &room.Restrictions,
		&room.AreaSqM, &room.Equipment, &room.SanitaryConditions, &room.IsAccessible,
		&room.AccessibilityNotes, &room.PhotoURLs,
		&room.CreatedAt, &room.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return room, nil
}

// photoURLsOrEmpty keeps photo_urls (NOT NULL) from receiving a NULL array.
func photoURLsOrEmpty(urls []string) []string {
	if urls == nil {
		return []string{}
	}
	return urls
}

// Create inserts the room and its Capacity bed places (labels 1..N) in one
// transaction.
func (r *RoomRepo) Create(ctx context.Context, room *domain.Room) error {
	const q = `
		INSERT INTO rooms (dormitory_id, floor_id, room_number, capacity, category, restrictions,
			area_sq_m, equipment, sanitary_conditions, is_accessible, accessibility_notes, photo_urls)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, floor, created_at, updated_at`
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, q,
		room.DormitoryID, room.FloorID, room.RoomNumber, room.Capacity,
		room.Category, room.Restrictions,
		room.AreaSqM, room.Equipment, room.SanitaryConditions, room.IsAccessible,
		room.AccessibilityNotes, photoURLsOrEmpty(room.PhotoURLs),
	).Scan(&room.ID, &room.Floor, &room.CreatedAt, &room.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	if _, err := addBedsTx(ctx, tx, room.ID, room.Capacity); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RoomRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Room, error) {
	q := `SELECT ` + roomColumns + ` FROM rooms WHERE id = $1`
	room, err := scanRoom(r.db.QueryRow(ctx, q, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return room, nil
}

func (r *RoomRepo) ListByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.Room, error) {
	q := `SELECT ` + roomColumns + ` FROM rooms WHERE dormitory_id = $1 ORDER BY ` + roomOrder
	rows, err := r.db.Query(ctx, q, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Room
	for rows.Next() {
		room, err := scanRoom(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, room)
	}
	return out, rows.Err()
}

// Update saves the room's fields and, in the same transaction, adds or
// retires bed places so the room's active bed count equals room.Capacity.
// Lowering the capacity retires beds nobody lives on or holds — out-of-
// service beds first, then from the end of the room's bed order (highest
// label first); if too few such beds exist it returns
// ErrBedOccupied and nothing is saved. Existing beds are never recreated,
// so their ids survive any capacity change.
func (r *RoomRepo) Update(ctx context.Context, room *domain.Room) error {
	const q = `
		UPDATE rooms
		SET room_number = $2, floor_id = $3, category = $4,
			area_sq_m = $5, equipment = $6, sanitary_conditions = $7, is_accessible = $8,
			accessibility_notes = $9, photo_urls = $10, updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := lockRoomTx(ctx, tx, room.ID); err != nil {
		return err
	}
	err = tx.QueryRow(ctx, q,
		room.ID, room.RoomNumber, room.FloorID, room.Category,
		room.AreaSqM, room.Equipment, room.SanitaryConditions, room.IsAccessible,
		room.AccessibilityNotes, photoURLsOrEmpty(room.PhotoURLs),
	).Scan(&room.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}

	var active int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM beds WHERE room_id = $1 AND retired_at IS NULL`, room.ID,
	).Scan(&active); err != nil {
		return err
	}
	switch {
	case room.Capacity > active:
		if _, err := addBedsTx(ctx, tx, room.ID, room.Capacity-active); err != nil {
			return err
		}
	case room.Capacity < active:
		toRetire := active - room.Capacity
		q := `
			SELECT b.id FROM beds b
			WHERE b.room_id = $1 AND b.retired_at IS NULL
			  AND NOT EXISTS (SELECT 1 FROM room_residents rr
			                  WHERE rr.bed_id = b.id AND rr.moved_out_at IS NULL)
			  AND NOT EXISTS (SELECT 1 FROM applications a
			                  WHERE a.held_bed_id = b.id AND a.status IN ` + activeHoldStatuses + `)
			ORDER BY (b.service_status = 'in_service'), ` + bedOrderDesc + `
			LIMIT $2`
		rows, err := tx.Query(ctx, q, room.ID, toRetire)
		if err != nil {
			return err
		}
		ids, err := pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
		if err != nil {
			return err
		}
		if len(ids) < toRetire {
			return repository.ErrBedOccupied
		}
		if _, err := tx.Exec(ctx,
			`UPDATE beds SET retired_at = now() WHERE id = ANY($1)`, ids,
		); err != nil {
			return err
		}
		if err := syncCapacityTx(ctx, tx, room.ID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *RoomRepo) UpdateRestrictions(ctx context.Context, id uuid.UUID, restrictions domain.RoomRestrictions) error {
	const q = `UPDATE rooms SET restrictions = $2, updated_at = now() WHERE id = $1`
	tag, err := r.db.Exec(ctx, q, id, restrictions)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

// Delete maps a foreign-key violation (e.g. an application still referencing
// this room via assigned_room_id/preferred_room_id, or a transfer request via
// current_room_id/requested_room_id) to ErrConflict — mirrors
// DormitoryRepo.Delete. room_residents itself cascades on room deletion, but
// RoomService.Delete refuses to get here while active residents remain.
func (r *RoomRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
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

// residentSelect reads room_residents rows together with their bed's
// label and inventory number; scan with scanResident.
const residentSelect = `
	SELECT rr.id, rr.room_id, rr.student_id, rr.bed_id, b.label, b.inventory_no,
		rr.moved_in_at, rr.moved_out_at
	FROM room_residents rr
	LEFT JOIN beds b ON b.id = rr.bed_id`

func scanResident(row pgx.Row) (*domain.RoomResident, error) {
	rr := &domain.RoomResident{}
	err := row.Scan(&rr.ID, &rr.RoomID, &rr.StudentID, &rr.BedID, &rr.BedLabel, &rr.BedInventoryNo,
		&rr.MovedInAt, &rr.MovedOutAt)
	if err != nil {
		return nil, err
	}
	return rr, nil
}

func collectResidents(rows pgx.Rows) ([]*domain.RoomResident, error) {
	defer rows.Close()
	var out []*domain.RoomResident
	for rows.Next() {
		rr, err := scanResident(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rr)
	}
	return out, rows.Err()
}

func (r *RoomRepo) ListActiveResidents(ctx context.Context, roomID uuid.UUID) ([]*domain.RoomResident, error) {
	q := residentSelect + `
		WHERE rr.room_id = $1 AND rr.moved_out_at IS NULL
		ORDER BY ` + bedOrderAsc
	rows, err := r.db.Query(ctx, q, roomID)
	if err != nil {
		return nil, err
	}
	return collectResidents(rows)
}

func (r *RoomRepo) AddResident(ctx context.Context, rr *domain.RoomResident) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := lockRoomTx(ctx, tx, rr.RoomID); err != nil {
		return err
	}

	var bed *domain.Bed
	if rr.BedID == nil {
		// The student's own held bed first, then the first free one.
		q := bedSelect + `
			WHERE b.room_id = $1 AND b.retired_at IS NULL AND rr.id IS NULL
			  AND b.service_status = 'in_service'
			  AND (ha.id IS NULL OR ha.student_id = $2)
			ORDER BY (ha.id IS NULL), ` + bedOrderAsc + `
			LIMIT 1`
		bed, err = scanBed(tx.QueryRow(ctx, q, rr.RoomID, rr.StudentID))
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNoFreeBed
		}
	} else {
		bed, err = scanBed(tx.QueryRow(ctx, bedSelect+` WHERE b.id = $1 AND b.room_id = $2`, *rr.BedID, rr.RoomID))
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
	}
	if err != nil {
		return err
	}
	if bed.RetiredAt != nil {
		return repository.ErrBedRetired
	}
	if bed.ResidentID != nil {
		return repository.ErrBedOccupied
	}
	if bed.HeldStudentID != nil && *bed.HeldStudentID != rr.StudentID {
		return repository.ErrBedReserved
	}
	if bed.ServiceStatus != domain.BedInService {
		return repository.ErrBedOutOfService
	}

	const q = `
		INSERT INTO room_residents (room_id, student_id, bed_id)
		VALUES ($1, $2, $3)
		RETURNING id, moved_in_at`
	if err := tx.QueryRow(ctx, q, rr.RoomID, rr.StudentID, bed.ID).Scan(&rr.ID, &rr.MovedInAt); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	rr.BedID = &bed.ID
	rr.BedLabel = &bed.Label
	rr.BedInventoryNo = &bed.InventoryNo
	return tx.Commit(ctx)
}

func (r *RoomRepo) MoveOutResident(ctx context.Context, residentRowID uuid.UUID) error {
	const q = `UPDATE room_residents SET moved_out_at = now() WHERE id = $1 AND moved_out_at IS NULL`
	tag, err := r.db.Exec(ctx, q, residentRowID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *RoomRepo) GetResidentByID(ctx context.Context, id uuid.UUID) (*domain.RoomResident, error) {
	rr, err := scanResident(r.db.QueryRow(ctx, residentSelect+` WHERE rr.id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return rr, nil
}

func (r *RoomRepo) ListResidentStudentIDsByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]uuid.UUID, error) {
	const q = `
		SELECT DISTINCT rr.student_id
		FROM room_residents rr
		JOIN rooms r ON r.id = rr.room_id
		WHERE r.dormitory_id = $1 AND rr.moved_out_at IS NULL`
	rows, err := r.db.Query(ctx, q, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (r *RoomRepo) GetActiveResidentByStudent(ctx context.Context, studentID uuid.UUID) (*domain.RoomResident, error) {
	q := residentSelect + ` WHERE rr.student_id = $1 AND rr.moved_out_at IS NULL`
	rr, err := scanResident(r.db.QueryRow(ctx, q, studentID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return rr, nil
}

// CountHeldSeats counts non-terminal, non-correction applications
// (pending/manager_review/approved) currently claiming roomID — via
// assigned_room_id once a manager has earmarked one, falling back to the
// student's own preferred_room_id otherwise. excludeApplicationID, when
// set, omits that one application from the count (used when checking
// whether an application may keep/take a room it may itself already hold).
func (r *RoomRepo) CountHeldSeats(ctx context.Context, roomID uuid.UUID, excludeApplicationID *uuid.UUID) (int, error) {
	const q = `
		SELECT count(*) FROM applications
		WHERE COALESCE(assigned_room_id, preferred_room_id) = $1
		  AND status IN ('pending', 'manager_review', 'approved')
		  AND ($2::uuid IS NULL OR id <> $2)`
	var count int
	if err := r.db.QueryRow(ctx, q, roomID, excludeApplicationID).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

// ListAvailabilityByDormitory returns every room of a dormitory together
// with its current resident and hold counts, in one query — used by the
// student-facing room picker so it doesn't have to fetch residents per room
// (see CountHeldSeats for what counts as a hold).
func (r *RoomRepo) ListAvailabilityByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.RoomAvailability, error) {
	q := `
		SELECT ` + roomColumns + `,
			(SELECT count(*) FROM room_residents rr WHERE rr.room_id = rooms.id AND rr.moved_out_at IS NULL) AS resident_count,
			(SELECT count(*) FROM applications a
				WHERE COALESCE(a.assigned_room_id, a.preferred_room_id) = rooms.id
				  AND a.status IN ('pending', 'manager_review', 'approved')) AS held_count,
			(SELECT count(*) FROM beds b
				WHERE b.room_id = rooms.id AND b.retired_at IS NULL
				  AND b.service_status <> 'in_service') AS out_of_service_count
		FROM rooms WHERE dormitory_id = $1 ORDER BY ` + roomOrder
	rows, err := r.db.Query(ctx, q, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.RoomAvailability
	for rows.Next() {
		room := &domain.Room{}
		avail := &domain.RoomAvailability{Room: room}
		err := rows.Scan(
			&room.ID, &room.DormitoryID, &room.FloorID, &room.FloorName,
			&room.RoomNumber, &room.Capacity, &room.Floor,
			&room.Category, &room.Restrictions,
			&room.AreaSqM, &room.Equipment, &room.SanitaryConditions, &room.IsAccessible,
			&room.AccessibilityNotes, &room.PhotoURLs,
			&room.CreatedAt, &room.UpdatedAt,
			&avail.ResidentCount, &avail.HeldCount, &avail.OutOfServiceCount,
		)
		if err != nil {
			return nil, err
		}
		out = append(out, avail)
	}
	return out, rows.Err()
}
