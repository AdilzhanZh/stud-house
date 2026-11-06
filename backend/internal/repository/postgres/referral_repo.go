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

type ReferralRepo struct {
	db *pgxpool.Pool
}

func NewReferralRepo(db *pgxpool.Pool) *ReferralRepo {
	return &ReferralRepo{db: db}
}

func (r *ReferralRepo) IssueForProtocol(ctx context.Context, protocolID uuid.UUID, signatoryName string) ([]uuid.UUID, error) {
	q := `
		INSERT INTO referrals (student_id, protocol_id, protocol_number, study_group, signatory_name)
		SELECT a.student_id, p.id, p.number, COALESCE(a.study_group, ''), $2
		FROM protocols p
		JOIN protocol_applications pa ON pa.protocol_id = p.id
		JOIN applications a ON a.id = pa.application_id
		WHERE p.id = $1 AND a.status IN ('approved', 'settled')
		UNION ALL
		SELECT u.id, p.id, p.number, ` + residentStudyGroupColumn + `, $2
		FROM protocols p
		JOIN protocol_residents pr ON pr.protocol_id = p.id
		JOIN users u ON u.id = pr.student_id
		WHERE p.id = $1
		ON CONFLICT (protocol_id, student_id) DO NOTHING
		RETURNING student_id`
	rows, err := r.db.Query(ctx, q, protocolID, signatoryName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var studentIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		studentIDs = append(studentIDs, id)
	}
	return studentIDs, rows.Err()
}

const referralSelect = `
	SELECT rf.id, rf.number, rf.token, rf.student_id, rf.protocol_number, rf.study_group,
		rf.signatory_name, rf.issued_at, u.full_name, COALESCE(sp.institute, ''),
		COALESCE(d.name, ''), COALESCE(d.address, ''), COALESCE(r.room_number, ''),
		rr.id IS NOT NULL AND NOT EXISTS (
			SELECT 1 FROM referrals newer
			WHERE newer.student_id = rf.student_id AND newer.number > rf.number
		)
	FROM referrals rf
	JOIN users u ON u.id = rf.student_id
	LEFT JOIN student_profiles sp ON sp.user_id = rf.student_id
	LEFT JOIN room_residents rr ON rr.student_id = rf.student_id AND rr.moved_out_at IS NULL
	LEFT JOIN rooms r ON r.id = rr.room_id
	LEFT JOIN dormitories d ON d.id = r.dormitory_id`

func (r *ReferralRepo) GetByToken(ctx context.Context, token string) (*domain.Referral, error) {
	return scanReferral(r.db.QueryRow(ctx, referralSelect+` WHERE rf.token = $1`, token))
}

func (r *ReferralRepo) GetLatestByStudent(ctx context.Context, studentID uuid.UUID) (*domain.Referral, error) {
	return scanReferral(r.db.QueryRow(ctx, referralSelect+` WHERE rf.student_id = $1 ORDER BY rf.number DESC LIMIT 1`, studentID))
}

func scanReferral(row pgx.Row) (*domain.Referral, error) {
	rf := &domain.Referral{}
	err := row.Scan(&rf.ID, &rf.Number, &rf.Token, &rf.StudentID, &rf.ProtocolNumber, &rf.StudyGroup,
		&rf.SignatoryName, &rf.IssuedAt, &rf.StudentFullName, &rf.Institute,
		&rf.DormitoryName, &rf.DormitoryAddress, &rf.RoomNumber, &rf.Valid)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, repository.ErrNotFound
		}
		return nil, err
	}
	return rf, nil
}
