package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

type StudentBenefitRepo struct {
	db *pgxpool.Pool
}

func NewStudentBenefitRepo(db *pgxpool.Pool) *StudentBenefitRepo {
	return &StudentBenefitRepo{db: db}
}

func (r *StudentBenefitRepo) Assign(ctx context.Context, sb *domain.StudentBenefit) error {
	const q = `
		INSERT INTO student_benefits (student_id, benefit_id, assigned_by)
		VALUES ($1, $2, $3)
		RETURNING id, assigned_at`
	err := r.db.QueryRow(ctx, q, sb.StudentID, sb.BenefitID, sb.AssignedBy).Scan(&sb.ID, &sb.AssignedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return repository.ErrConflict
		}
		return err
	}
	return nil
}

func (r *StudentBenefitRepo) ListByStudent(ctx context.Context, studentID uuid.UUID) ([]*domain.StudentBenefit, error) {
	const q = `SELECT id, student_id, benefit_id, assigned_by, assigned_at FROM student_benefits WHERE student_id = $1`
	rows, err := r.db.Query(ctx, q, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.StudentBenefit
	for rows.Next() {
		sb := &domain.StudentBenefit{}
		if err := rows.Scan(&sb.ID, &sb.StudentID, &sb.BenefitID, &sb.AssignedBy, &sb.AssignedAt); err != nil {
			return nil, err
		}
		out = append(out, sb)
	}
	return out, rows.Err()
}

func (r *StudentBenefitRepo) Revoke(ctx context.Context, studentID, benefitID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM student_benefits WHERE student_id = $1 AND benefit_id = $2`, studentID, benefitID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return repository.ErrNotFound
	}
	return nil
}
