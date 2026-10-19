package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
)

type CampaignStatsRepo struct {
	db *pgxpool.Pool
}

func NewCampaignStatsRepo(db *pgxpool.Pool) *CampaignStatsRepo {
	return &CampaignStatsRepo{db: db}
}

func (r *CampaignStatsRepo) ListStageCounts(ctx context.Context) ([]*domain.StageCount, error) {
	rows, err := r.db.Query(ctx, `
		SELECT dormitory_id, dormitory_name, stage, submitted_on, applications
		FROM stats_application_stages
		ORDER BY submitted_on`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.StageCount
	for rows.Next() {
		s := &domain.StageCount{}
		var stage string
		if err := rows.Scan(&s.DormitoryID, &s.DormitoryName, &stage, &s.SubmittedOn, &s.Applications); err != nil {
			return nil, err
		}
		s.Stage = domain.CampaignStage(stage)
		out = append(out, s)
	}
	return out, rows.Err()
}

func (r *CampaignStatsRepo) ListDormitorySeats(ctx context.Context) ([]*domain.DormitorySeats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT dormitory_id, dormitory_name, total_capacity, room_beds, residents, held, free_beds
		FROM stats_dormitory_seats
		ORDER BY dormitory_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*domain.DormitorySeats
	for rows.Next() {
		d := &domain.DormitorySeats{}
		if err := rows.Scan(&d.DormitoryID, &d.DormitoryName, &d.TotalCapacity, &d.RoomBeds, &d.Residents, &d.Held, &d.FreeBeds); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
