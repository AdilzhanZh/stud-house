package handler

import (
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type contractResponse struct {
	ID               uuid.UUID  `json:"id"`
	ApplicationID    uuid.UUID  `json:"application_id"`
	FileURL          string     `json:"file_url"`
	Status           string     `json:"status"`
	SentAt           time.Time  `json:"sent_at"`
	RespondedAt      *time.Time `json:"responded_at"`
	ResponseDeadline time.Time  `json:"response_deadline"`
	ReminderSentAt   *time.Time `json:"reminder_sent_at"`
	CreatedAt        time.Time  `json:"created_at"`
}

func contractDTO(c *domain.Contract) contractResponse {
	return contractResponse{
		ID:               c.ID,
		ApplicationID:    c.ApplicationID,
		FileURL:          c.FileURL,
		Status:           string(c.Status),
		SentAt:           c.SentAt,
		RespondedAt:      c.RespondedAt,
		ResponseDeadline: c.ResponseDeadline,
		ReminderSentAt:   c.ReminderSentAt,
		CreatedAt:        c.CreatedAt,
	}
}

type paymentResponse struct {
	ID             uuid.UUID  `json:"id"`
	ContractID     uuid.UUID  `json:"contract_id"`
	Amount         float64    `json:"amount"`
	Currency       string     `json:"currency"`
	ReceiptFileURL *string    `json:"receipt_file_url"`
	Status         string     `json:"status"`
	SubmittedAt    *time.Time `json:"submitted_at"`
	ConfirmedBy    *uuid.UUID `json:"confirmed_by"`
	ConfirmedAt    *time.Time `json:"confirmed_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

func paymentDTO(p *domain.Payment) paymentResponse {
	return paymentResponse{
		ID:             p.ID,
		ContractID:     p.ContractID,
		Amount:         p.Amount,
		Currency:       p.Currency,
		ReceiptFileURL: p.ReceiptFileURL,
		Status:         string(p.Status),
		SubmittedAt:    p.SubmittedAt,
		ConfirmedBy:    p.ConfirmedBy,
		ConfirmedAt:    p.ConfirmedAt,
		CreatedAt:      p.CreatedAt,
	}
}

type exitRequestResponse struct {
	ID             uuid.UUID  `json:"id"`
	RoomResidentID uuid.UUID  `json:"room_resident_id"`
	StudentID      uuid.UUID  `json:"student_id"`
	Reason         *string    `json:"reason"`
	Status         string     `json:"status"`
	RequestedAt    time.Time  `json:"requested_at"`
	DecidedBy      *uuid.UUID `json:"decided_by"`
	DecidedAt      *time.Time `json:"decided_at"`
	Comment        *string    `json:"comment"`
}

func exitRequestDTO(e *domain.ExitRequest) exitRequestResponse {
	return exitRequestResponse{
		ID:             e.ID,
		RoomResidentID: e.RoomResidentID,
		StudentID:      e.StudentID,
		Reason:         e.Reason,
		Status:         string(e.Status),
		RequestedAt:    e.RequestedAt,
		DecidedBy:      e.DecidedBy,
		DecidedAt:      e.DecidedAt,
		Comment:        e.Comment,
	}
}

func exitRequestsDTO(list []*domain.ExitRequest) []exitRequestResponse {
	out := make([]exitRequestResponse, 0, len(list))
	for _, e := range list {
		out = append(out, exitRequestDTO(e))
	}
	return out
}

type transferRequestResponse struct {
	ID                   uuid.UUID  `json:"id"`
	StudentID            uuid.UUID  `json:"student_id"`
	CurrentRoomID        uuid.UUID  `json:"current_room_id"`
	RequestedDormitoryID *uuid.UUID `json:"requested_dormitory_id"`
	RequestedRoomID      *uuid.UUID `json:"requested_room_id"`
	Reason               *string    `json:"reason"`
	Status               string     `json:"status"`
	DecidedBy            *uuid.UUID `json:"decided_by"`
	DecidedAt            *time.Time `json:"decided_at"`
	Comment              *string    `json:"comment"`
	CreatedAt            time.Time  `json:"created_at"`
}

func transferRequestDTO(t *domain.TransferRequest) transferRequestResponse {
	return transferRequestResponse{
		ID:                   t.ID,
		StudentID:            t.StudentID,
		CurrentRoomID:        t.CurrentRoomID,
		RequestedDormitoryID: t.RequestedDormitoryID,
		RequestedRoomID:      t.RequestedRoomID,
		Reason:               t.Reason,
		Status:               string(t.Status),
		DecidedBy:            t.DecidedBy,
		DecidedAt:            t.DecidedAt,
		Comment:              t.Comment,
		CreatedAt:            t.CreatedAt,
	}
}

func transferRequestsDTO(list []*domain.TransferRequest) []transferRequestResponse {
	out := make([]transferRequestResponse, 0, len(list))
	for _, t := range list {
		out = append(out, transferRequestDTO(t))
	}
	return out
}
