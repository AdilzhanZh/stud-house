package handler

import (
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

type applicationResponse struct {
	ID                uuid.UUID  `json:"id"`
	StudentID         uuid.UUID  `json:"student_id"`
	DormitoryID       uuid.UUID  `json:"dormitory_id"`
	Status            string     `json:"status"`
	PreferredRoomType *string    `json:"preferred_room_type"`
	PreferredRoomID   *uuid.UUID `json:"preferred_room_id"`
	Notes             *string    `json:"notes"`
	StudyGroup        string     `json:"study_group"`
	Hometown          string     `json:"hometown"`
	ParentContact     string     `json:"parent_contact"`
	AssignedRoomID    *uuid.UUID `json:"assigned_room_id"`
	HandledBy         *uuid.UUID `json:"handled_by"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func applicationDTO(a *domain.Application) applicationResponse {
	return applicationResponse{
		ID:                a.ID,
		StudentID:         a.StudentID,
		DormitoryID:       a.DormitoryID,
		Status:            string(a.Status),
		PreferredRoomType: a.PreferredRoomType,
		PreferredRoomID:   a.PreferredRoomID,
		Notes:             a.Notes,
		StudyGroup:        a.StudyGroup,
		Hometown:          a.Hometown,
		ParentContact:     a.ParentContact,
		AssignedRoomID:    a.AssignedRoomID,
		HandledBy:         a.HandledBy,
		CreatedAt:         a.CreatedAt,
		UpdatedAt:         a.UpdatedAt,
	}
}

func applicationsDTO(list []*domain.Application) []applicationResponse {
	out := make([]applicationResponse, 0, len(list))
	for _, a := range list {
		out = append(out, applicationDTO(a))
	}
	return out
}

type applicationStatusHistoryResponse struct {
	ID            uuid.UUID `json:"id"`
	ApplicationID uuid.UUID `json:"application_id"`
	FromStatus    *string   `json:"from_status"`
	ToStatus      string    `json:"to_status"`
	Comment       *string   `json:"comment"`
	ChangedBy     uuid.UUID `json:"changed_by"`
	CreatedAt     time.Time `json:"created_at"`
}

func applicationStatusHistoryDTO(h *domain.ApplicationStatusHistory) applicationStatusHistoryResponse {
	var from *string
	if h.FromStatus != nil {
		f := string(*h.FromStatus)
		from = &f
	}
	return applicationStatusHistoryResponse{
		ID:            h.ID,
		ApplicationID: h.ApplicationID,
		FromStatus:    from,
		ToStatus:      string(h.ToStatus),
		Comment:       h.Comment,
		ChangedBy:     h.ChangedBy,
		CreatedAt:     h.CreatedAt,
	}
}

func applicationStatusHistoriesDTO(list []*domain.ApplicationStatusHistory) []applicationStatusHistoryResponse {
	out := make([]applicationStatusHistoryResponse, 0, len(list))
	for _, h := range list {
		out = append(out, applicationStatusHistoryDTO(h))
	}
	return out
}

type applicationDocumentResponse struct {
	ID                          uuid.UUID  `json:"id"`
	ApplicationID               uuid.UUID  `json:"application_id"`
	BenefitRequiredDocumentID   *uuid.UUID `json:"benefit_required_document_id"`
	DormitoryRequiredDocumentID *uuid.UUID `json:"dormitory_required_document_id"`
	DocumentName                *string    `json:"document_name"`
	DisplayNameKk               string     `json:"display_name_kk"`
	DisplayNameRu               string     `json:"display_name_ru"`
	FileURL                     string     `json:"file_url"`
	UploadedAt                  time.Time  `json:"uploaded_at"`
}

func applicationDocumentDTO(d *domain.ApplicationDocument) applicationDocumentResponse {
	return applicationDocumentResponse{
		ID:                          d.ID,
		ApplicationID:               d.ApplicationID,
		BenefitRequiredDocumentID:   d.BenefitRequiredDocumentID,
		DormitoryRequiredDocumentID: d.DormitoryRequiredDocumentID,
		DocumentName:                d.DocumentName,
		DisplayNameKk:               d.DisplayNameKk,
		DisplayNameRu:               d.DisplayNameRu,
		FileURL:                     d.FileURL,
		UploadedAt:                  d.UploadedAt,
	}
}

func applicationDocumentsDTO(list []*domain.ApplicationDocument) []applicationDocumentResponse {
	out := make([]applicationDocumentResponse, 0, len(list))
	for _, d := range list {
		out = append(out, applicationDocumentDTO(d))
	}
	return out
}

// applicationDetailResponse combines an application with its documents and
// status history, for the manager's single-application view.
type applicationDetailResponse struct {
	applicationResponse
	Documents []applicationDocumentResponse      `json:"documents"`
	History   []applicationStatusHistoryResponse `json:"history"`
}

type notificationResponse struct {
	ID                   uuid.UUID  `json:"id"`
	UserID               uuid.UUID  `json:"user_id"`
	Type                 string     `json:"type"`
	Title                string     `json:"title"`
	Body                 string     `json:"body"`
	IsRead               bool       `json:"is_read"`
	RelatedApplicationID *uuid.UUID `json:"related_application_id"`
	CreatedAt            time.Time  `json:"created_at"`
}

func notificationDTO(n *domain.Notification) notificationResponse {
	return notificationResponse{
		ID:                   n.ID,
		UserID:               n.UserID,
		Type:                 string(n.Type),
		Title:                n.Title,
		Body:                 n.Body,
		IsRead:               n.IsRead,
		RelatedApplicationID: n.RelatedApplicationID,
		CreatedAt:            n.CreatedAt,
	}
}

func notificationsDTO(list []*domain.Notification) []notificationResponse {
	out := make([]notificationResponse, 0, len(list))
	for _, n := range list {
		out = append(out, notificationDTO(n))
	}
	return out
}
