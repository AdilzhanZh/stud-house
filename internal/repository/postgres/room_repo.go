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

func (r *RoomRepo) Create(ctx context.Context, room *domain.Room) error {
	const q = `
		INSERT INTO rooms (dormitory_id, room_number, capacity, restrictions)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRow(ctx, q, room.DormitoryID, room.RoomNumber, room.Capacity, room.Restrictions).
		Scan(&room.ID, &room.CreatedAt, &room.UpdatedAt)
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
	const q = `
		SELECT id, dormitory_id, room_number, capacity, restrictions, created_at, updated_at
		FROM rooms WHERE id = $1`
	room := &domain.Room{}
	err := r.db.QueryRow(ctx, q, id).Scan(&room.ID, &room.DormitoryID, &room.RoomNumber, &room.Capacity, &room.Restrictions, &room.CreatedAt, &room.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return room, nil
}

func (r *RoomRepo) ListByDormitory(ctx context.Context, dormitoryID uuid.UUID) ([]*domain.Room, error) {
	const q = `
		SELECT id, dormitory_id, room_number, capacity, restrictions, created_at, updated_at
		FROM rooms WHERE dormitory_id = $1 ORDER BY room_number`
	rows, err := r.db.Query(ctx, q, dormitoryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Room
	for rows.Next() {
		room := &domain.Room{}
		if err := rows.Scan(&room.ID, &room.DormitoryID, &room.RoomNumber, &room.Capacity, &room.Restrictions, &room.CreatedAt, &room.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, room)
	}
	return out, rows.Err()
}

func (r *RoomRepo) Update(ctx context.Context, room *domain.Room) error {
	const q = `
		UPDATE rooms SET room_number = $2, capacity = $3, updated_at = now()
		WHERE id = $1
		RETURNING updated_at`
	err := r.db.QueryRow(ctx, q, room.ID, room.RoomNumber, room.Capacity).Scan(&room.UpdatedAt)
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
