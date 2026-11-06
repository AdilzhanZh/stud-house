package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
)

type PushSubscriptionRepo struct {
	db *pgxpool.Pool
}

func NewPushSubscriptionRepo(db *pgxpool.Pool) *PushSubscriptionRepo {
	return &PushSubscriptionRepo{db: db}
}

func (r *PushSubscriptionRepo) Save(ctx context.Context, s *domain.PushSubscription) error {
	const q = `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (endpoint) DO UPDATE
			SET user_id = $1, p256dh = $3, auth = $4, user_agent = $5
		RETURNING id, created_at`
	return r.db.QueryRow(ctx, q, s.UserID, s.Endpoint, s.P256dh, s.Auth, s.UserAgent).Scan(&s.ID, &s.CreatedAt)
}

func (r *PushSubscriptionRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.PushSubscription, error) {
	const q = `
		SELECT id, user_id, endpoint, p256dh, auth, user_agent, created_at
		FROM push_subscriptions WHERE user_id = $1`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []*domain.PushSubscription
	for rows.Next() {
		s := &domain.PushSubscription{}
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth, &s.UserAgent, &s.CreatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *PushSubscriptionRepo) DeleteForUser(ctx context.Context, userID uuid.UUID, endpoint string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, userID, endpoint)
	return err
}

func (r *PushSubscriptionRepo) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}
