package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type AssistantRepo struct {
	db *pgxpool.Pool
}

func NewAssistantRepo(db *pgxpool.Pool) *AssistantRepo {
	return &AssistantRepo{db: db}
}

const assistantConversationColumns = `id, user_id, role_key, created_at, updated_at`

func scanAssistantConversation(row pgx.Row) (*domain.AssistantConversation, error) {
	c := &domain.AssistantConversation{}
	if err := row.Scan(&c.ID, &c.UserID, &c.RoleKey, &c.CreatedAt, &c.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func (r *AssistantRepo) CreateConversation(ctx context.Context, c *domain.AssistantConversation) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO assistant_conversations (user_id, role_key) VALUES ($1, $2) RETURNING id, created_at, updated_at`,
		c.UserID, c.RoleKey).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *AssistantRepo) GetConversation(ctx context.Context, id, userID uuid.UUID) (*domain.AssistantConversation, error) {
	return scanAssistantConversation(r.db.QueryRow(ctx,
		`SELECT `+assistantConversationColumns+` FROM assistant_conversations WHERE id = $1 AND user_id = $2`, id, userID))
}

func (r *AssistantRepo) GetLatestConversation(ctx context.Context, userID uuid.UUID) (*domain.AssistantConversation, error) {
	return scanAssistantConversation(r.db.QueryRow(ctx,
		`SELECT `+assistantConversationColumns+` FROM assistant_conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`, userID))
}

func (r *AssistantRepo) ListMessages(ctx context.Context, conversationID uuid.UUID) ([]*domain.AssistantMessage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, conversation_id, seq, role, content, display_text, created_at
		FROM assistant_messages WHERE conversation_id = $1 ORDER BY seq`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.AssistantMessage
	for rows.Next() {
		m := &domain.AssistantMessage{}
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Seq, &m.Role, &m.Content, &m.DisplayText, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *AssistantRepo) AppendMessages(ctx context.Context, conversationID uuid.UUID, expectedNextSeq int, msgs []*domain.AssistantMessage) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var next int
	if err := tx.QueryRow(ctx,
		`SELECT COALESCE(max(seq), -1) + 1 FROM assistant_messages WHERE conversation_id = $1`, conversationID).Scan(&next); err != nil {
		return err
	}
	if next != expectedNextSeq {
		return repository.ErrConflict
	}
	for i, m := range msgs {
		m.ConversationID = conversationID
		m.Seq = next + i
		err := tx.QueryRow(ctx, `
			INSERT INTO assistant_messages (conversation_id, seq, role, content, display_text)
			VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
			conversationID, m.Seq, m.Role, m.Content, m.DisplayText).Scan(&m.ID, &m.CreatedAt)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return repository.ErrConflict
			}
			return err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE assistant_conversations SET updated_at = now() WHERE id = $1`, conversationID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *AssistantRepo) CountUserTurnsSince(ctx context.Context, userID uuid.UUID, t time.Time) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT count(*) FROM assistant_messages m
		JOIN assistant_conversations c ON c.id = m.conversation_id
		WHERE c.user_id = $1 AND m.role = 'user' AND m.display_text IS NOT NULL AND m.created_at >= $2`,
		userID, t).Scan(&n)
	return n, err
}
