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

type ResidenceCertificateRepo struct {
	db *pgxpool.Pool
}

func NewResidenceCertificateRepo(db *pgxpool.Pool) *ResidenceCertificateRepo {
	return &ResidenceCertificateRepo{db: db}
}

// Issue copies the student's current stay and profile in one statement, so the
// certificate can't mix a room from before a move with details from after it.
// No active stay means no row to insert, hence ErrNotFound.
func (r *ResidenceCertificateRepo) Issue(ctx context.Context, studentID uuid.UUID, signatoryName string) (*domain.ResidenceCertificate, error) {
	const q = `
		INSERT INTO residence_certificates (student_id, room_resident_id, student_full_name, iin, institute,
			study_group, course, dormitory_name, dormitory_address, room_number, moved_in_at, signatory_name)
		SELECT u.id, rr.id, u.full_name, COALESCE(u.iin, ''), COALESCE(sp.institute, ''),
			COALESCE(sp.study_group, ''), sp.course, d.name, COALESCE(d.address, ''), r.room_number,
			rr.moved_in_at, $2
		FROM room_residents rr
		JOIN users u ON u.id = rr.student_id
		JOIN rooms r ON r.id = rr.room_id
		JOIN dormitories d ON d.id = r.dormitory_id
		LEFT JOIN student_profiles sp ON sp.user_id = u.id
		WHERE rr.student_id = $1 AND rr.moved_out_at IS NULL
		RETURNING token`
	var token string
	if err := r.db.QueryRow(ctx, q, studentID, signatoryName).Scan(&token); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return r.GetByToken(ctx, token)
}

const residenceCertificateSelect = `
	SELECT c.id, c.number, c.token, c.student_id, c.student_full_name, c.iin, c.institute, c.study_group,
		c.course, c.dormitory_name, c.dormitory_address, c.room_number, c.moved_in_at, c.signatory_name,
		c.issued_at, rr.id IS NOT NULL AND rr.moved_out_at IS NULL
	FROM residence_certificates c
	LEFT JOIN room_residents rr ON rr.id = c.room_resident_id`

func (r *ResidenceCertificateRepo) GetByToken(ctx context.Context, token string) (*domain.ResidenceCertificate, error) {
	return scanResidenceCertificate(r.db.QueryRow(ctx, residenceCertificateSelect+` WHERE c.token = $1`, token))
}

func (r *ResidenceCertificateRepo) GetLatestByStudent(ctx context.Context, studentID uuid.UUID) (*domain.ResidenceCertificate, error) {
	return scanResidenceCertificate(r.db.QueryRow(ctx,
		residenceCertificateSelect+` WHERE c.student_id = $1 ORDER BY c.number DESC LIMIT 1`, studentID))
}

func scanResidenceCertificate(row pgx.Row) (*domain.ResidenceCertificate, error) {
	c := &domain.ResidenceCertificate{}
	err := row.Scan(&c.ID, &c.Number, &c.Token, &c.StudentID, &c.StudentFullName, &c.IIN, &c.Institute,
		&c.StudyGroup, &c.Course, &c.DormitoryName, &c.DormitoryAddress, &c.RoomNumber, &c.MovedInAt,
		&c.SignatoryName, &c.IssuedAt, &c.StillResides)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return c, nil
}
