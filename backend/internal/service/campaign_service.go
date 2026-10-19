package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

// kyzylorda is the university's local time (UTC+5, no DST) — campaign days
// are counted in it, matching the stats_application_stages view's
// submitted_on column.
var kyzylorda = time.FixedZone("Asia/Qyzylorda", 5*60*60)

// campaignTrendDays is how many recent days the daily-submissions trend
// covers.
const campaignTrendDays = 14

type DailyCount struct {
	Day   time.Time
	Count int
}

type DormitoryCampaign struct {
	domain.DormitorySeats
	// Submitted counts applications to this dormitory since the campaign
	// start; AwaitingReview counts every one still waiting on a manager.
	Submitted      int
	AwaitingReview int
}

type CampaignStats struct {
	// CampaignStart is the latest academic-year cutoff (the same July 30
	// AcademicYearService rolls courses over on).
	CampaignStart time.Time
	// Submitted and Reviewed only count applications submitted since
	// CampaignStart; Reviewed is every one a manager has already acted on.
	Submitted int
	Reviewed  int
	// Stages counts open stages regardless of submission date (they're
	// still work to do) and closed stages since CampaignStart only.
	Stages      map[domain.CampaignStage]int
	Triage      map[domain.TriageColor]int
	Daily       []DailyCount
	Dormitories []DormitoryCampaign
}

type CampaignService struct {
	stats  repository.CampaignStatsRepository
	triage *TriageService
}

func NewCampaignService(stats repository.CampaignStatsRepository, triage *TriageService) *CampaignService {
	return &CampaignService{stats: stats, triage: triage}
}

func campaignStart(now time.Time) time.Time {
	local := now.In(kyzylorda)
	start := time.Date(local.Year(), rolloverMonth, rolloverDay, 0, 0, 0, 0, kyzylorda)
	if local.Before(start) {
		start = start.AddDate(-1, 0, 0)
	}
	return start
}

func (s *CampaignService) Stats(ctx context.Context, now time.Time) (*CampaignStats, error) {
	stageCounts, err := s.stats.ListStageCounts(ctx)
	if err != nil {
		return nil, err
	}
	seats, err := s.stats.ListDormitorySeats(ctx)
	if err != nil {
		return nil, err
	}
	pending, err := s.triage.ListPending(ctx)
	if err != nil {
		return nil, err
	}

	start := campaignStart(now)
	today := time.Date(now.In(kyzylorda).Year(), now.In(kyzylorda).Month(), now.In(kyzylorda).Day(), 0, 0, 0, 0, kyzylorda)
	trendStart := today.AddDate(0, 0, -(campaignTrendDays - 1))

	out := &CampaignStats{
		CampaignStart: start,
		Stages:        map[domain.CampaignStage]int{},
		Triage:        map[domain.TriageColor]int{domain.TriageGreen: 0, domain.TriageYellow: 0, domain.TriageRed: 0},
	}
	for _, t := range pending {
		out.Triage[t.Color]++
	}

	daily := make(map[string]int, campaignTrendDays)
	type dormTotals struct{ submitted, awaitingReview int }
	byDorm := map[uuid.UUID]*dormTotals{}
	for _, sc := range stageCounts {
		// submitted_on is a DATE; pgx hands it back as UTC midnight.
		day := time.Date(sc.SubmittedOn.Year(), sc.SubmittedOn.Month(), sc.SubmittedOn.Day(), 0, 0, 0, 0, kyzylorda)
		inCampaign := !day.Before(start)

		d := byDorm[sc.DormitoryID]
		if d == nil {
			d = &dormTotals{}
			byDorm[sc.DormitoryID] = d
		}
		if sc.Stage == domain.StageAwaitingReview {
			d.awaitingReview += sc.Applications
		}
		if inCampaign {
			out.Submitted += sc.Applications
			d.submitted += sc.Applications
			if sc.Stage != domain.StageAwaitingReview {
				out.Reviewed += sc.Applications
			}
		}
		if inCampaign || sc.Stage.Open() {
			out.Stages[sc.Stage] += sc.Applications
		}
		if !day.Before(trendStart) {
			daily[day.Format(time.DateOnly)] += sc.Applications
		}
	}

	for i := 0; i < campaignTrendDays; i++ {
		day := trendStart.AddDate(0, 0, i)
		out.Daily = append(out.Daily, DailyCount{Day: day, Count: daily[day.Format(time.DateOnly)]})
	}

	for _, seat := range seats {
		dc := DormitoryCampaign{DormitorySeats: *seat}
		if d := byDorm[seat.DormitoryID]; d != nil {
			dc.Submitted = d.submitted
			dc.AwaitingReview = d.awaitingReview
		}
		out.Dormitories = append(out.Dormitories, dc)
	}
	return out, nil
}
