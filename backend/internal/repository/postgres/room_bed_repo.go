package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

// Bed places (see domain.Bed and migration 000098). Every statement that
// changes which beds a room has, or puts a stay on a bed, first locks the
// room row (lockRoomTx), so two managers working on the same room are
// handled one after the other and rooms.capacity always equals the active
// bed count.

// activeHoldStatuses are the application statuses whose held_bed_id
// reserves a bed (see migration 000100 and RoomRepo.CountHeldSeats).
const activeHoldStatuses = `('pending', 'manager_review', 'approved')`

// bedSelect reads beds together with their current stay and active hold
// (if any); scan with scanBed. The joined room_residents alias is rr and
// the holding application is ha, so callers can filter on "rr.id IS NULL"
// for unoccupied beds and "ha.id IS NULL" for unreserved ones.
const bedSelect = `
	SELECT b.id, b.inventory_no, b.room_id, b.label, b.created_at, b.retired_at,
		rr.id, rr.student_id, ha.id, ha.student_id,
		b.service_status, b.service_reason, b.service_until,
		b.service_changed_at, b.service_changed_by
	FROM beds b
	LEFT JOIN room_residents rr ON rr.bed_id = b.id AND rr.moved_out_at IS NULL
	LEFT JOIN applications ha ON ha.held_bed_id = b.id AND ha.status IN ` + activeHoldStatuses

// Beds are ordered numerically when labels are numbers ("2" before "10"),
// then by text, then by creation. Desc is the exact reverse, used to pick
// which free bed goes first when a room's capacity is lowered.
const (
	bedOrderAsc = `(b.label ~ '^[0-9]{1,9}$') DESC,
		CASE WHEN b.label ~ '^[0-9]{1,9}$' THEN b.label::int END ASC,
		b.label ASC, b.inventory_no ASC`
	bedOrderDesc = `(b.label ~ '^[0-9]{1,9}$') ASC,
		CASE WHEN b.label ~ '^[0-9]{1,9}$' THEN b.label::int END DESC,
		b.label DESC, b.inventory_no DESC`
)

func scanBed(row pgx.Row) (*domain.Bed, error) {
	b := &domain.Bed{}
	err := row.Scan(&b.ID, &b.InventoryNo, &b.RoomID, &b.Label, &b.CreatedAt, &b.RetiredAt,
		&b.ResidentID, &b.StudentID, &b.HeldApplicationID, &b.HeldStudentID,
		&b.ServiceStatus, &b.ServiceReason, &b.ServiceUntil,
		&b.ServiceChangedAt, &b.ServiceChangedBy)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func lockRoomTx(ctx context.Context, tx pgx.Tx, roomID uuid.UUID) error {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `SELECT id FROM rooms WHERE id = $1 FOR UPDATE`, roomID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return repository.ErrNotFound
	}
	return err
}

func syncCapacityTx(ctx context.Context, tx pgx.Tx, roomID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		UPDATE rooms
		SET capacity = (SELECT count(*) FROM beds WHERE room_id = $1 AND retired_at IS NULL),
			updated_at = now()
		WHERE id = $1`, roomID)
	return err
}

// addBedsTx creates count new bed places in the room, each labelled with
// the smallest positive number no active bed of the room uses yet, then
// syncs rooms.capacity. The caller must hold the room lock (or have just
// created the room in tx).
func addBedsTx(ctx context.Context, tx pgx.Tx, roomID uuid.UUID, count int) ([]*domain.Bed, error) {
	const q = `
		INSERT INTO beds (room_id, label)
		SELECT $1, min(n)::text
		FROM generate_series(1, 100000) AS n
		WHERE n::text NOT IN (SELECT label FROM beds WHERE room_id = $1 AND retired_at IS NULL)
		RETURNING id, inventory_no, room_id, label, created_at, retired_at`
	out := make([]*domain.Bed, 0, count)
	for i := 0; i < count; i++ {
		b := &domain.Bed{ServiceStatus: domain.BedInService}
		if err := tx.QueryRow(ctx, q, roomID).Scan(
			&b.ID, &b.InventoryNo, &b.RoomID, &b.Label, &b.CreatedAt, &b.RetiredAt,
		); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	if err := syncCapacityTx(ctx, tx, roomID); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *RoomRepo) ListBeds(ctx context.Context, roomID uuid.UUID, includeRetired bool) ([]*domain.Bed, error) {
	q := bedSelect + `
		WHERE b.room_id = $1 AND ($2 OR b.retired_at IS NULL)
		ORDER BY (b.retired_at IS NOT NULL), ` + bedOrderAsc
	rows, err := r.db.Query(ctx, q, roomID, includeRetired)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.Bed
	for rows.Next() {
		b, err := scanBed(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *RoomRepo) GetBedByID(ctx context.Context, id uuid.UUID) (*domain.Bed, error) {
	b, err := scanBed(r.db.QueryRow(ctx, bedSelect+` WHERE b.id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return b, nil
}

func (r *RoomRepo) AddBeds(ctx context.Context, roomID uuid.UUID, count int) ([]*domain.Bed, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if err := lockRoomTx(ctx, tx, roomID); err != nil {
		return nil, err
	}
	beds, err := addBedsTx(ctx, tx, roomID, count)
	if err != nil {
		return nil, err
	}
	return beds, tx.Commit(ctx)
}

// bedForChangeTx locks the bed's room and re-reads the bed under that lock.
func bedForChangeTx(ctx context.Context, tx pgx.Tx, bedID uuid.UUID) (*domain.Bed, error) {
	var roomID uuid.UUID
	err := tx.QueryRow(ctx, `SELECT room_id FROM beds WHERE id = $1`, bedID).Scan(&roomID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, repository.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := lockRoomTx(ctx, tx, roomID); err != nil {
		return nil, err
	}
	return scanBed(tx.QueryRow(ctx, bedSelect+` WHERE b.id = $1`, bedID))
}

func (r *RoomRepo) RetireBed(ctx context.Context, bedID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	bed, err := bedForChangeTx(ctx, tx, bedID)
	if err != nil {
		return err
	}
	if bed.RetiredAt != nil {
		return repository.ErrBedRetired
	}
	if bed.ResidentID != nil {
		return repository.ErrBedOccupied
	}
	if bed.HeldApplicationID != nil {
		return repository.ErrBedReserved
	}
	var active int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM beds WHERE room_id = $1 AND retired_at IS NULL`, bed.RoomID,
	).Scan(&active); err != nil {
		return err
	}
	if active <= 1 {
		return repository.ErrLastBed
	}
	if _, err := tx.Exec(ctx, `UPDATE beds SET retired_at = now() WHERE id = $1`, bedID); err != nil {
		return err
	}
	if err := syncCapacityTx(ctx, tx, bed.RoomID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RoomRepo) RenameBed(ctx context.Context, bedID uuid.UUID, label string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	bed, err := bedForChangeTx(ctx, tx, bedID)
	if err != nil {
		return err
	}
	if bed.RetiredAt != nil {
		return repository.ErrBedRetired
	}
	if _, err := tx.Exec(ctx, `UPDATE beds SET label = $2 WHERE id = $1`, bedID, strings.TrimSpace(label)); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return tx.Commit(ctx)
}

func (r *RoomRepo) ListBedHistory(ctx context.Context, bedID uuid.UUID) ([]*domain.RoomResident, error) {
	rows, err := r.db.Query(ctx, residentSelect+`
		WHERE rr.bed_id = $1
		ORDER BY rr.moved_in_at DESC, rr.id`, bedID)
	if err != nil {
		return nil, err
	}
	return collectResidents(rows)
}

func (r *RoomRepo) SetBedServiceStatus(ctx context.Context, bedID uuid.UUID, status domain.BedServiceStatus,
	reason *string, until *time.Time, changedBy uuid.UUID) (*domain.Bed, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	bed, err := bedForChangeTx(ctx, tx, bedID)
	if err != nil {
		return nil, err
	}
	if bed.RetiredAt != nil {
		return nil, repository.ErrBedRetired
	}
	if status != domain.BedInService {
		if bed.ResidentID != nil {
			return nil, repository.ErrBedOccupied
		}
		if bed.HeldApplicationID != nil {
			return nil, repository.ErrBedReserved
		}
	}
	if bed.ServiceStatus == status && equalPtr(bed.ServiceReason, reason) && equalDatePtr(bed.ServiceUntil, until) {
		return bed, tx.Commit(ctx)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE beds
		SET service_status = $2, service_reason = $3, service_until = $4,
			service_changed_at = now(), service_changed_by = $5
		WHERE id = $1`, bedID, status, reason, until, changedBy); err != nil {
		return nil, err
	}
	updated, err := scanBed(tx.QueryRow(ctx, bedSelect+` WHERE b.id = $1`, bedID))
	if err != nil {
		return nil, err
	}
	return updated, tx.Commit(ctx)
}

func equalPtr[T comparable](a, b *T) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func equalDatePtr(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.Format(time.DateOnly) == b.Format(time.DateOnly)
}

func (r *RoomRepo) ListBedStatusHistory(ctx context.Context, bedID uuid.UUID) ([]*domain.BedStatusChange, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, bed_id, old_status, new_status, reason, until, changed_by, changed_at,
			basis_type, basis_id, act_number, act_date, act_file_url, student_id, backfilled
		FROM bed_status_history
		WHERE bed_id = $1
		ORDER BY seq DESC`, bedID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.BedStatusChange
	for rows.Next() {
		c := &domain.BedStatusChange{}
		if err := rows.Scan(&c.ID, &c.BedID, &c.OldStatus, &c.NewStatus, &c.Reason, &c.Until,
			&c.ChangedBy, &c.ChangedAt, &c.BasisType, &c.BasisID, &c.ActNumber, &c.ActDate,
			&c.ActFileURL, &c.StudentID, &c.Backfilled); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *RoomRepo) CountOutOfServiceBeds(ctx context.Context, roomID uuid.UUID) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT count(*) FROM beds
		WHERE room_id = $1 AND retired_at IS NULL AND service_status <> 'in_service'`, roomID).Scan(&n)
	return n, err
}
