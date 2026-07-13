package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type NotificationRepo struct {
	db *pgxpool.Pool
}

func NewNotificationRepo(db *pgxpool.Pool) *NotificationRepo {
	return &NotificationRepo{db: db}
}

func (r *NotificationRepo) Create(ctx context.Context, n *domain.Notification) error {
	const q = `
		INSERT INTO notifications (user_id, type, title, body, related_application_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, is_read, created_at`
	return r.db.QueryRow(ctx, q, n.UserID, string(n.Type), n.Title, n.Body, n.RelatedApplicationID).
		Scan(&n.ID, &n.IsRead, &n.CreatedAt)
}

func (r *NotificationRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Notification, error) {
	const q = `
		SELECT id, user_id, type, title, body, is_read, related_application_id, created_at
		FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.Notification
	for rows.Next() {
		n := &domain.Notification{}
		var typ string
		if err := rows.Scan(&n.ID, &n.UserID, &typ, &n.Title, &n.Body, &n.IsRead, &n.RelatedApplicationID, &n.CreatedAt); err != nil {
			return nil, err
		}
		n.Type = domain.NotificationType(typ)
		out = append(out, n)
	}
	return out, rows.Err()
}

func (r *NotificationRepo) MarkRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	const q = `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`
	tag, err := r.db.Exec(ctx, q, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *NotificationRepo) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	const q = `DELETE FROM notifications WHERE id = $1 AND user_id = $2`
	tag, err := r.db.Exec(ctx, q, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}

func (r *NotificationRepo) DeleteAllByUser(ctx context.Context, userID uuid.UUID) error {
	const q = `DELETE FROM notifications WHERE user_id = $1`
	_, err := r.db.Exec(ctx, q, userID)
	return err
}
