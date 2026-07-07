package handler

import (
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// DTOs decouple the wire format from domain structs — most importantly, they
// never expose PasswordHash.

type userResponse struct {
	ID            uuid.UUID `json:"id"`
	FullName      string    `json:"full_name"`
	Email         string    `json:"email"`
	Phone         string    `json:"phone"`
	Role          string    `json:"role"`
	IsChairperson bool      `json:"is_chairperson"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func userDTO(u *domain.User) userResponse {
	return userResponse{
		ID:            u.ID,
		FullName:      u.FullName,
		Email:         u.Email,
		Phone:         u.Phone,
		Role:          string(u.Role),
		IsChairperson: u.IsChairperson,
		CreatedAt:     u.CreatedAt,
		UpdatedAt:     u.UpdatedAt,
	}
}

func usersDTO(users []*domain.User) []userResponse {
	out := make([]userResponse, 0, len(users))
	for _, u := range users {
		out = append(out, userDTO(u))
	}
	return out
}

type studentProfileResponse struct {
	UserID uuid.UUID `json:"user_id"`
	Gender *string   `json:"gender"`
	Course *int16    `json:"course"`
}

func studentProfileDTO(p *domain.StudentProfile) studentProfileResponse {
	var gender *string
	if p.Gender != nil {
		g := string(*p.Gender)
		gender = &g
	}
	return studentProfileResponse{UserID: p.UserID, Gender: gender, Course: p.Course}
}

type dormitoryResponse struct {
	ID               uuid.UUID `json:"id"`
	Name             string    `json:"name"`
	Address          string    `json:"address"`
	TotalCapacity    int       `json:"total_capacity"`
	PaymentQRCodeURL *string   `json:"payment_qr_code_url"`
	CreatedBy        uuid.UUID `json:"created_by"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func dormitoryDTO(d *domain.Dormitory) dormitoryResponse {
	return dormitoryResponse{
		ID:               d.ID,
		Name:             d.Name,
		Address:          d.Address,
		TotalCapacity:    d.TotalCapacity,
		PaymentQRCodeURL: d.PaymentQRCodeURL,
		CreatedBy:        d.CreatedBy,
		CreatedAt:        d.CreatedAt,
		UpdatedAt:        d.UpdatedAt,
	}
}

func dormitoriesDTO(list []*domain.Dormitory) []dormitoryResponse {
	out := make([]dormitoryResponse, 0, len(list))
	for _, d := range list {
		out = append(out, dormitoryDTO(d))
	}
	return out
}

type dormitoryCapacityResponse struct {
	DormitoryID   uuid.UUID `json:"dormitory_id"`
	TotalCapacity int       `json:"total_capacity"`
	AllocatedBeds int       `json:"allocated_beds"`
}

func dormitoryCapacityDTO(c *domain.DormitoryCapacity) dormitoryCapacityResponse {
	return dormitoryCapacityResponse{DormitoryID: c.DormitoryID, TotalCapacity: c.TotalCapacity, AllocatedBeds: c.AllocatedBeds}
}

type dormitoryImageResponse struct {
	ID          uuid.UUID `json:"id"`
	DormitoryID uuid.UUID `json:"dormitory_id"`
	ImageURL    string    `json:"image_url"`
	CreatedAt   time.Time `json:"created_at"`
}

func dormitoryImageDTO(i *domain.DormitoryImage) dormitoryImageResponse {
	return dormitoryImageResponse{ID: i.ID, DormitoryID: i.DormitoryID, ImageURL: i.ImageURL, CreatedAt: i.CreatedAt}
}

func dormitoryImagesDTO(list []*domain.DormitoryImage) []dormitoryImageResponse {
	out := make([]dormitoryImageResponse, 0, len(list))
	for _, i := range list {
		out = append(out, dormitoryImageDTO(i))
	}
	return out
}

type roomResponse struct {
	ID           uuid.UUID               `json:"id"`
	DormitoryID  uuid.UUID               `json:"dormitory_id"`
	RoomNumber   string                  `json:"room_number"`
	Capacity     int                     `json:"capacity"`
	Restrictions domain.RoomRestrictions `json:"restrictions"`
	CreatedAt    time.Time               `json:"created_at"`
	UpdatedAt    time.Time               `json:"updated_at"`
}

func roomDTO(r *domain.Room) roomResponse {
	return roomResponse{
		ID:           r.ID,
		DormitoryID:  r.DormitoryID,
		RoomNumber:   r.RoomNumber,
		Capacity:     r.Capacity,
		Restrictions: r.Restrictions,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

func roomsDTO(list []*domain.Room) []roomResponse {
	out := make([]roomResponse, 0, len(list))
	for _, r := range list {
		out = append(out, roomDTO(r))
	}
	return out
}

type roomResidentResponse struct {
	ID         uuid.UUID  `json:"id"`
	RoomID     uuid.UUID  `json:"room_id"`
	StudentID  uuid.UUID  `json:"student_id"`
	MovedInAt  time.Time  `json:"moved_in_at"`
	MovedOutAt *time.Time `json:"moved_out_at"`
}

func roomResidentDTO(rr *domain.RoomResident) roomResidentResponse {
	return roomResidentResponse{ID: rr.ID, RoomID: rr.RoomID, StudentID: rr.StudentID, MovedInAt: rr.MovedInAt, MovedOutAt: rr.MovedOutAt}
}

func roomResidentsDTO(list []*domain.RoomResident) []roomResidentResponse {
	out := make([]roomResidentResponse, 0, len(list))
	for _, rr := range list {
		out = append(out, roomResidentDTO(rr))
	}
	return out
}

type benefitResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedBy   uuid.UUID `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func benefitDTO(b *domain.Benefit) benefitResponse {
	return benefitResponse{ID: b.ID, Name: b.Name, Description: b.Description, CreatedBy: b.CreatedBy, CreatedAt: b.CreatedAt, UpdatedAt: b.UpdatedAt}
}

func benefitsDTO(list []*domain.Benefit) []benefitResponse {
	out := make([]benefitResponse, 0, len(list))
	for _, b := range list {
		out = append(out, benefitDTO(b))
	}
	return out
}

type benefitFieldResponse struct {
	ID        uuid.UUID `json:"id"`
	BenefitID uuid.UUID `json:"benefit_id"`
	FieldName string    `json:"field_name"`
	FieldType string    `json:"field_type"`
	CreatedAt time.Time `json:"created_at"`
}

func benefitFieldDTO(f *domain.BenefitField) benefitFieldResponse {
	return benefitFieldResponse{ID: f.ID, BenefitID: f.BenefitID, FieldName: f.FieldName, FieldType: f.FieldType, CreatedAt: f.CreatedAt}
}

func benefitFieldsDTO(list []*domain.BenefitField) []benefitFieldResponse {
	out := make([]benefitFieldResponse, 0, len(list))
	for _, f := range list {
		out = append(out, benefitFieldDTO(f))
	}
	return out
}

type benefitRequiredDocumentResponse struct {
	ID           uuid.UUID `json:"id"`
	BenefitID    uuid.UUID `json:"benefit_id"`
	DocumentName string    `json:"document_name"`
	CreatedAt    time.Time `json:"created_at"`
}

func benefitRequiredDocumentDTO(d *domain.BenefitRequiredDocument) benefitRequiredDocumentResponse {
	return benefitRequiredDocumentResponse{ID: d.ID, BenefitID: d.BenefitID, DocumentName: d.DocumentName, CreatedAt: d.CreatedAt}
}

func benefitRequiredDocumentsDTO(list []*domain.BenefitRequiredDocument) []benefitRequiredDocumentResponse {
	out := make([]benefitRequiredDocumentResponse, 0, len(list))
	for _, d := range list {
		out = append(out, benefitRequiredDocumentDTO(d))
	}
	return out
}

type studentBenefitResponse struct {
	ID         uuid.UUID `json:"id"`
	StudentID  uuid.UUID `json:"student_id"`
	BenefitID  uuid.UUID `json:"benefit_id"`
	AssignedBy uuid.UUID `json:"assigned_by"`
	AssignedAt time.Time `json:"assigned_at"`
}

func studentBenefitDTO(sb *domain.StudentBenefit) studentBenefitResponse {
	return studentBenefitResponse{ID: sb.ID, StudentID: sb.StudentID, BenefitID: sb.BenefitID, AssignedBy: sb.AssignedBy, AssignedAt: sb.AssignedAt}
}

func studentBenefitsDTO(list []*domain.StudentBenefit) []studentBenefitResponse {
	out := make([]studentBenefitResponse, 0, len(list))
	for _, sb := range list {
		out = append(out, studentBenefitDTO(sb))
	}
	return out
}
