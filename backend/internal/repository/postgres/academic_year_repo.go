package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

var academicYearRolloverStateID = uuid.MustParse("00000000-0000-0000-0000-000000000003")

// maxCourseCase mirrors domain.AcademicDegree.MaxCourse() — bachelor's (and
// any unset/legacy value) runs 4 years, master's 2, doctoral 3. Kept here
// rather than read back from Go so the graduate/advance updates below stay
// a single SQL statement each.
const maxCourseCase = `CASE sp.academic_degree WHEN 'master' THEN 2 WHEN 'doctorate' THEN 3 ELSE 4 END`

type AcademicYearRepo struct {
	db *pgxpool.Pool
}

func NewAcademicYearRepo(db *pgxpool.Pool) *AcademicYearRepo {
	return &AcademicYearRepo{db: db}
}

func (r *AcademicYearRepo) LastRolledOverYear(ctx context.Context) (*int, error) {
	var year *int
	err := r.db.QueryRow(ctx, `SELECT last_rolled_over_year FROM academic_year_rollover_state WHERE id = $1`, academicYearRolloverStateID).Scan(&year)
	return year, err
}

func (r *AcademicYearRepo) BaselineIfUnset(ctx context.Context, year int) (bool, error) {
	const q = `
		UPDATE academic_year_rollover_state
		SET last_rolled_over_year = $2
		WHERE id = $1 AND last_rolled_over_year IS NULL`
	tag, err := r.db.Exec(ctx, q, academicYearRolloverStateID, year)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *AcademicYearRepo) RolloverCourses(ctx context.Context, year int) (int64, int64, bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, 0, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var lastYear *int
	err = tx.QueryRow(ctx, `SELECT last_rolled_over_year FROM academic_year_rollover_state WHERE id = $1 FOR UPDATE`, academicYearRolloverStateID).Scan(&lastYear)
	if err != nil {
		return 0, 0, false, err
	}
	if lastYear != nil && *lastYear >= year {
		return 0, 0, false, nil
	}

	// Graduate first: students already at (or somehow past) their degree's
	// max course don't advance further, they leave. Only 'approved'
	// students are touched, so an already-graduated/pending/rejected row
	// (or a retry) isn't reprocessed.
	const graduateQ = `
		UPDATE users u
		SET approval_status = 'graduated', updated_at = now()
		FROM student_profiles sp
		WHERE u.id = sp.user_id
			AND u.role = 'student'
			AND u.approval_status = 'approved'
			AND sp.course IS NOT NULL
			AND sp.academic_degree IS NOT NULL
			AND sp.course >= ` + maxCourseCase
	graduateTag, err := tx.Exec(ctx, graduateQ)
	if err != nil {
		return 0, 0, false, err
	}

	// Everyone still 'approved' below max advances by one course. The
	// graduate update above already flipped this year's graduates to
	// approval_status = 'graduated', so this WHERE naturally excludes them.
	const advanceQ = `
		UPDATE student_profiles sp
		SET course = course + 1, updated_at = now()
		FROM users u
		WHERE u.id = sp.user_id
			AND u.role = 'student'
			AND u.approval_status = 'approved'
			AND sp.course IS NOT NULL
			AND sp.academic_degree IS NOT NULL
			AND sp.course < ` + maxCourseCase
	advanceTag, err := tx.Exec(ctx, advanceQ)
	if err != nil {
		return 0, 0, false, err
	}

	if _, err := tx.Exec(ctx, `UPDATE academic_year_rollover_state SET last_rolled_over_year = $2 WHERE id = $1`, academicYearRolloverStateID, year); err != nil {
		return 0, 0, false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, 0, false, err
	}
	return graduateTag.RowsAffected(), advanceTag.RowsAffected(), true, nil
}
