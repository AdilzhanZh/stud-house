package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/service"
	"student-house/pkg/response"
)

type CampaignHandler struct {
	campaign *service.CampaignService
}

func NewCampaignHandler(campaign *service.CampaignService) *CampaignHandler {
	return &CampaignHandler{campaign: campaign}
}

type dailyCountResponse struct {
	Day   string `json:"day"`
	Count int    `json:"count"`
}

type dormitoryCampaignResponse struct {
	DormitoryID    uuid.UUID `json:"dormitory_id"`
	DormitoryName  string    `json:"dormitory_name"`
	TotalCapacity  int       `json:"total_capacity"`
	RoomBeds       int       `json:"room_beds"`
	Residents      int       `json:"residents"`
	Held           int       `json:"held"`
	FreeBeds       int       `json:"free_beds"`
	Submitted      int       `json:"submitted"`
	AwaitingReview int       `json:"awaiting_review"`
}

type campaignStatsResponse struct {
	CampaignStart string                      `json:"campaign_start"`
	Submitted     int                         `json:"submitted"`
	Reviewed      int                         `json:"reviewed"`
	Stages        map[string]int              `json:"stages"`
	Triage        map[string]int              `json:"triage"`
	Daily         []dailyCountResponse        `json:"daily"`
	Dormitories   []dormitoryCampaignResponse `json:"dormitories"`
}

// Get is manager/admin-only: aggregate progress of the current intake
// campaign (no per-student data).
func (h *CampaignHandler) Get(c *gin.Context) {
	stats, err := h.campaign.Stats(c.Request.Context(), time.Now())
	if err != nil {
		response.Error(c, err)
		return
	}
	out := campaignStatsResponse{
		CampaignStart: stats.CampaignStart.Format(time.DateOnly),
		Submitted:     stats.Submitted,
		Reviewed:      stats.Reviewed,
		Stages:        map[string]int{},
		Triage:        map[string]int{},
		Daily:         make([]dailyCountResponse, 0, len(stats.Daily)),
		Dormitories:   make([]dormitoryCampaignResponse, 0, len(stats.Dormitories)),
	}
	for k, v := range stats.Stages {
		out.Stages[string(k)] = v
	}
	for k, v := range stats.Triage {
		out.Triage[string(k)] = v
	}
	for _, d := range stats.Daily {
		out.Daily = append(out.Daily, dailyCountResponse{Day: d.Day.Format(time.DateOnly), Count: d.Count})
	}
	for _, d := range stats.Dormitories {
		out.Dormitories = append(out.Dormitories, dormitoryCampaignResponse{
			DormitoryID:    d.DormitoryID,
			DormitoryName:  d.DormitoryName,
			TotalCapacity:  d.TotalCapacity,
			RoomBeds:       d.RoomBeds,
			Residents:      d.Residents,
			Held:           d.Held,
			FreeBeds:       d.FreeBeds,
			Submitted:      d.Submitted,
			AwaitingReview: d.AwaitingReview,
		})
	}
	response.OK(c, out)
}
