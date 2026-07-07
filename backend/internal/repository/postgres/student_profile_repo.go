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

type StudentProfileRepo struct {
	db *pgxpool.Pool
}

func NewStudentProfileRepo(db *pgxpool.Pool) *StudentProfileRepo {
	return &StudentProfileRepo{db: db}
}

func (r *StudentProfileRepo) Upsert(ctx context.Context, p *domain.StudentProfile) error {
	const q = `
		INSERT INTO student_profiles (user_id, gender, course)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET gender = $2, course = $3, updated_at = now()
		RETURNING created_at, updated_at`
	var gender *string
	if p.Gender != nil {
		g := string(*p.Gender)
		gender = &g
	}
	return r.db.QueryRow(ctx, q, p.UserID, gender, p.Course).Scan(&p.CreatedAt, &p.UpdatedAt)
}

func (r *StudentProfileRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.StudentProfile, error) {
	const q = `SELECT user_id, gender, course, created_at, updated_at FROM student_profiles WHERE user_id = $1`
	p := &domain.StudentProfile{}
	var gender *string
	err := r.db.QueryRow(ctx, q, userID).Scan(&p.UserID, &gender, &p.Course, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	if gender != nil {
		g := domain.Gender(*gender)
		p.Gender = &g
	}
	return p, nil
}
