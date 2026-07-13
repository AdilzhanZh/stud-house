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

const roomColumns = `id, dormitory_id, room_number, capacity, floor, category, area_sq_m, equipment, top_beds, bottom_beds, restrictions, created_at, updated_at`

func scanRoom(row pgx.Row) (*domain.Room, error) {
	room := &domain.Room{}
	err := row.Scan(
		&room.ID, &room.DormitoryID, &room.RoomNumber, &room.Capacity, &room.Floor,
		&room.Category, &room.AreaSqM, &room.Equipment, &room.TopBeds, &room.BottomBeds,
		&room.Restrictions, &room.CreatedAt, &room.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return room, nil
}

func (r *RoomRepo) Create(ctx context.Context, room *domain.Room) error {
	const q = `
		INSERT INTO rooms (dormitory_id, room_number, capacity, floor, category, area_sq_m, equipment, top_beds, bottom_beds, restrictions)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRow(ctx, q,
		room.DormitoryID, room.RoomNumber, room.Capacity, room.Floor,
		room.Category, room.AreaSqM, room.Equipment, room.TopBeds, room.BottomBeds, room.Restrictions,
	).Scan(&room.ID, &room.CreatedAt, &room.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return nil
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
	q := `SELECT ` + roomColumns + ` FROM rooms WHERE dormitory_id = $1 ORDER BY room_number`
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

func (r *RoomRepo) Update(ctx context.Context, room *domain.Room) error {
	const q = `
		UPDATE rooms
		SET room_number = $2, capacity = $3, floor = $4, category = $5,
			area_sq_m = $6, equipment = $7, top_beds = $8, bottom_beds = $9, updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	err := r.db.QueryRow(ctx, q,
		room.ID, room.RoomNumber, room.Capacity, room.Floor, room.Category,
		room.AreaSqM, room.Equipment, room.TopBeds, room.BottomBeds,
	).Scan(&room.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return repository.ErrNotFound
		}
		return err
	}
	return nil
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

func (r *RoomRepo) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *RoomRepo) ListActiveResidents(ctx context.Context, roomID uuid.UUID) ([]*domain.RoomResident, error) {
	const q = `
		SELECT id, room_id, student_id, moved_in_at, moved_out_at
		FROM room_residents WHERE room_id = $1 AND moved_out_at IS NULL`
	rows, err := r.db.Query(ctx, q, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.RoomResident
	for rows.Next() {
		rr := &domain.RoomResident{}
		if err := rows.Scan(&rr.ID, &rr.RoomID, &rr.StudentID, &rr.MovedInAt, &rr.MovedOutAt); err != nil {
			return nil, err
		}
		out = append(out, rr)
	}
	return out, rows.Err()
}

func (r *RoomRepo) AddResident(ctx context.Context, rr *domain.RoomResident) error {
	const q = `
		INSERT INTO room_residents (room_id, student_id)
		VALUES ($1, $2)
		RETURNING id, moved_in_at`
	return r.db.QueryRow(ctx, q, rr.RoomID, rr.StudentID).Scan(&rr.ID, &rr.MovedInAt)
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
	const q = `
		SELECT id, room_id, student_id, moved_in_at, moved_out_at
		FROM room_residents WHERE student_id = $1 AND moved_out_at IS NULL`
	rr := &domain.RoomResident{}
	err := r.db.QueryRow(ctx, q, studentID).Scan(&rr.ID, &rr.RoomID, &rr.StudentID, &rr.MovedInAt, &rr.MovedOutAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return rr, nil
}
