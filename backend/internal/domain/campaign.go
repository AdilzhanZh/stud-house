package domain

import (
	"time"

	"github.com/google/uuid"
)

// CampaignStage is where an application currently sits in the intake
// pipeline — a coarser, contract-aware view of ApplicationStatus (see the
// stats_application_stages view for the exact mapping).
type CampaignStage string

const (
	StageAwaitingReview       CampaignStage = "awaiting_review"
	StageAwaitingDocuments    CampaignStage = "awaiting_documents"
	StageAwaitingCommission   CampaignStage = "awaiting_commission"
	StageAwaitingConfirmation CampaignStage = "awaiting_confirmation"
	StageConfirmationOverdue  CampaignStage = "confirmation_overdue"
	StageSettled              CampaignStage = "settled"
	StageRejected             CampaignStage = "rejected"
	StageContractDeclined     CampaignStage = "contract_declined"
)

// Open reports whether applications in this stage still need someone to
// act — those count regardless of when they were submitted.
func (s CampaignStage) Open() bool {
	switch s {
	case StageSettled, StageRejected, StageContractDeclined:
		return false
	default:
		return true
	}
}

// StageCount is one row of the stats_application_stages view.
type StageCount struct {
	DormitoryID   uuid.UUID
	DormitoryName string
	Stage         CampaignStage
	SubmittedOn   time.Time
	Applications  int
}

// DormitorySeats is one row of the stats_dormitory_seats view.
type DormitorySeats struct {
	DormitoryID   uuid.UUID
	DormitoryName string
	TotalCapacity int
	RoomBeds      int
	Residents     int
	Held          int
	FreeBeds      int
}
