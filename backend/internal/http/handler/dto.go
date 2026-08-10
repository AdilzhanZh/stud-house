package handler

import (
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

// DTOs decouple the wire format from domain structs — most importantly, they
// never expose PasswordHash.

type userResponse struct {
	ID                uuid.UUID `json:"id"`
	FullName          string    `json:"full_name"`
	Email             string    `json:"email"`
	Phone             string    `json:"phone"`
	IIN               *string   `json:"iin"`
	Role              string    `json:"role"`
	IsCommitteeMember bool      `json:"is_committee_member"`
	IsChairperson     bool      `json:"is_chairperson"`
	ApprovalStatus    string    `json:"approval_status"`
	AvatarURL         *string   `json:"avatar_url"`
	EmailVerified     bool      `json:"email_verified"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

func userDTO(u *domain.User) userResponse {
	return userResponse{
		ID:                u.ID,
		FullName:          u.FullName,
		Email:             u.Email,
		Phone:             u.Phone,
		IIN:               u.IIN,
		Role:              string(u.Role),
		IsCommitteeMember: u.IsCommitteeMember,
		IsChairperson:     u.IsChairperson,
		ApprovalStatus:    string(u.ApprovalStatus),
		AvatarURL:         u.AvatarURL,
		EmailVerified:     u.EmailVerifiedAt != nil,
		CreatedAt:         u.CreatedAt,
		UpdatedAt:         u.UpdatedAt,
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
	UserID         uuid.UUID `json:"user_id"`
	Gender         *string   `json:"gender"`
	Course         *int16    `json:"course"`
	AcademicDegree *string   `json:"academic_degree"`
}

func studentProfileDTO(p *domain.StudentProfile) studentProfileResponse {
	var gender *string
	if p.Gender != nil {
		g := string(*p.Gender)
		gender = &g
	}
	var academicDegree *string
	if p.AcademicDegree != nil {
		d := string(*p.AcademicDegree)
		academicDegree = &d
	}
	return studentProfileResponse{UserID: p.UserID, Gender: gender, Course: p.Course, AcademicDegree: academicDegree}
}

type dormitoryResponse struct {
	ID                    uuid.UUID             `json:"id"`
	Name                  string                `json:"name"`
	Address               string                `json:"address"`
	Phone                 *string               `json:"phone"`
	Type                  *domain.DormitoryType `json:"dorm_type"`
	FloorCount            *int                  `json:"floor_count"`
	TotalRoomsTarget      *int                  `json:"total_rooms_target"`
	TotalCapacity         int                   `json:"total_capacity"`
	RoomsMale             *int                  `json:"rooms_male"`
	RoomsFemale           *int                  `json:"rooms_female"`
	RoomsMixed            *int                  `json:"rooms_mixed"`
	MonthlyPayment        *float64              `json:"monthly_payment"`
	YearlyPayment         *float64              `json:"yearly_payment"`
	BuiltYear             *time.Time            `json:"built_year"`
	CommissionedYear      *time.Time            `json:"commissioned_year"`
	OwnershipForm         *string               `json:"ownership_form"`
	ClosedForApplications bool                  `json:"closed_for_applications"`
	CreatedBy             uuid.UUID             `json:"created_by"`
	CreatedAt             time.Time             `json:"created_at"`
	UpdatedAt             time.Time             `json:"updated_at"`
}

func dormitoryDTO(d *domain.Dormitory) dormitoryResponse {
	return dormitoryResponse{
		ID:                    d.ID,
		Name:                  d.Name,
		Address:               d.Address,
		Phone:                 d.Phone,
		Type:                  d.Type,
		FloorCount:            d.FloorCount,
		TotalRoomsTarget:      d.TotalRoomsTarget,
		TotalCapacity:         d.TotalCapacity,
		RoomsMale:             d.RoomsMale,
		RoomsFemale:           d.RoomsFemale,
		RoomsMixed:            d.RoomsMixed,
		MonthlyPayment:        d.MonthlyPayment,
		YearlyPayment:         d.YearlyPayment,
		BuiltYear:             d.BuiltYear,
		CommissionedYear:      d.CommissionedYear,
		OwnershipForm:         d.OwnershipForm,
		ClosedForApplications: d.ClosedForApplications,
		CreatedBy:             d.CreatedBy,
		CreatedAt:             d.CreatedAt,
		UpdatedAt:             d.UpdatedAt,
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
	DormitoryID      uuid.UUID `json:"dormitory_id"`
	TotalCapacity    int       `json:"total_capacity"`
	AllocatedBeds    int       `json:"allocated_beds"`
	TotalRoomsTarget *int      `json:"total_rooms_target"`
	RoomsCreated     int       `json:"rooms_created"`
}

func dormitoryCapacityDTO(c *domain.DormitoryCapacity) dormitoryCapacityResponse {
	return dormitoryCapacityResponse{
		DormitoryID:      c.DormitoryID,
		TotalCapacity:    c.TotalCapacity,
		AllocatedBeds:    c.AllocatedBeds,
		TotalRoomsTarget: c.TotalRoomsTarget,
		RoomsCreated:     c.RoomsCreated,
	}
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

type dormitoryRequiredDocumentResponse struct {
	ID           uuid.UUID `json:"id"`
	DormitoryID  uuid.UUID `json:"dormitory_id"`
	DocumentID   uuid.UUID `json:"document_id"`
	DocumentName string    `json:"document_name"`
	CreatedAt    time.Time `json:"created_at"`
}

func dormitoryRequiredDocumentDTO(d *domain.DormitoryRequiredDocument) dormitoryRequiredDocumentResponse {
	return dormitoryRequiredDocumentResponse{ID: d.ID, DormitoryID: d.DormitoryID, DocumentID: d.DocumentID, DocumentName: d.DocumentName, CreatedAt: d.CreatedAt}
}

func dormitoryRequiredDocumentsDTO(list []*domain.DormitoryRequiredDocument) []dormitoryRequiredDocumentResponse {
	out := make([]dormitoryRequiredDocumentResponse, 0, len(list))
	for _, d := range list {
		out = append(out, dormitoryRequiredDocumentDTO(d))
	}
	return out
}

type requiredDocumentResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

func requiredDocumentDTO(d *domain.RequiredDocument) requiredDocumentResponse {
	return requiredDocumentResponse{ID: d.ID, Name: d.Name, CreatedAt: d.CreatedAt}
}

func requiredDocumentsDTO(list []*domain.RequiredDocument) []requiredDocumentResponse {
	out := make([]requiredDocumentResponse, 0, len(list))
	for _, d := range list {
		out = append(out, requiredDocumentDTO(d))
	}
	return out
}

type roomResponse struct {
	ID           uuid.UUID               `json:"id"`
	DormitoryID  uuid.UUID               `json:"dormitory_id"`
	RoomNumber   string                  `json:"room_number"`
	Capacity     int                     `json:"capacity"`
	Floor        *int                    `json:"floor"`
	Category     string                  `json:"category"`
	AreaSqM      *float64                `json:"area_sq_m"`
	Equipment    *string                 `json:"equipment"`
	TopBeds      int                     `json:"top_beds"`
	BottomBeds   int                     `json:"bottom_beds"`
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
		Floor:        r.Floor,
		Category:     r.Category,
		AreaSqM:      r.AreaSqM,
		Equipment:    r.Equipment,
		TopBeds:      r.TopBeds,
		BottomBeds:   r.BottomBeds,
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
	Priority    int       `json:"priority"`
	CreatedBy   uuid.UUID `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func benefitDTO(b *domain.Benefit) benefitResponse {
	return benefitResponse{ID: b.ID, Name: b.Name, Description: b.Description, Priority: b.Priority, CreatedBy: b.CreatedBy, CreatedAt: b.CreatedAt, UpdatedAt: b.UpdatedAt}
}

func benefitsDTO(list []*domain.Benefit) []benefitResponse {
	out := make([]benefitResponse, 0, len(list))
	for _, b := range list {
		out = append(out, benefitDTO(b))
	}
	return out
}

type benefitRequiredDocumentResponse struct {
	ID           uuid.UUID `json:"id"`
	BenefitID    uuid.UUID `json:"benefit_id"`
	DocumentID   uuid.UUID `json:"document_id"`
	DocumentName string    `json:"document_name"`
	CreatedAt    time.Time `json:"created_at"`
}

func benefitRequiredDocumentDTO(d *domain.BenefitRequiredDocument) benefitRequiredDocumentResponse {
	return benefitRequiredDocumentResponse{ID: d.ID, BenefitID: d.BenefitID, DocumentID: d.DocumentID, DocumentName: d.DocumentName, CreatedAt: d.CreatedAt}
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
