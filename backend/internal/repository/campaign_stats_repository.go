package repository

import (
	"context"

	"student-house/internal/domain"
)

// CampaignStatsRepository reads the aggregate-only stats_* views.
type CampaignStatsRepository interface {
	ListStageCounts(ctx context.Context) ([]*domain.StageCount, error)
	ListDormitorySeats(ctx context.Context) ([]*domain.DormitorySeats, error)
}
