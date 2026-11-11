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
	IsManager         bool      `json:"is_manager"`
	IsCommitteeMember bool      `json:"is_committee_member"`
	IsChairperson     bool      `json:"is_chairperson"`
	ApprovalStatus    string    `json:"approval_status"`
	AvatarURL         *string   `json:"avatar_url"`
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
		IsManager:         u.IsManager,
		IsCommitteeMember: u.IsCommitteeMember,
		IsChairperson:     u.IsChairperson,
		ApprovalStatus:    string(u.ApprovalStatus),
		AvatarURL:         u.AvatarURL,
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
	Institute      string    `json:"institute"`
	StudyGroup     string    `json:"study_group"`
	Hometown       string    `json:"hometown"`
	ParentContact  string    `json:"parent_contact"`
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
	return studentProfileResponse{
		UserID: p.UserID, Gender: gender, Course: p.Course, AcademicDegree: academicDegree,
		Institute: p.Institute, StudyGroup: p.StudyGroup, Hometown: p.Hometown, ParentContact: p.ParentContact,
	}
}

type dormitoryResponse struct {
	ID                      uuid.UUID             `json:"id"`
	Name                    string                `json:"name"`
	Address                 string                `json:"address"`
	Phone                   *string               `json:"phone"`
	Type                    *domain.DormitoryType `json:"dorm_type"`
	FloorCount              *int                  `json:"floor_count"`
	TotalRoomsTarget        *int                  `json:"total_rooms_target"`
	TotalCapacity           int                   `json:"total_capacity"`
	MonthlyPaymentBachelor  *float64              `json:"monthly_payment_bachelor"`
	MonthlyPaymentMaster    *float64              `json:"monthly_payment_master"`
	MonthlyPaymentDoctorate *float64              `json:"monthly_payment_doctorate"`
	YearlyPaymentBachelor   *float64              `json:"yearly_payment_bachelor"`
	YearlyPaymentMaster     *float64              `json:"yearly_payment_master"`
	YearlyPaymentDoctorate  *float64              `json:"yearly_payment_doctorate"`
	BuiltYear               *time.Time            `json:"built_year"`
	CommissionedYear        *time.Time            `json:"commissioned_year"`
	ObjectID                uuid.UUID             `json:"object_id"`
	ObjectName              string                `json:"object_name"`
	OwnershipForm           *string               `json:"ownership_form"`
	ClosedForApplications   bool                  `json:"closed_for_applications"`
	Latitude                *float64              `json:"latitude"`
	Longitude               *float64              `json:"longitude"`
	CreatedBy               uuid.UUID             `json:"created_by"`
	CreatedAt               time.Time             `json:"created_at"`
	UpdatedAt               time.Time             `json:"updated_at"`
}

func dormitoryDTO(d *domain.Dormitory) dormitoryResponse {
	return dormitoryResponse{
		ID:                      d.ID,
		Name:                    d.Name,
		Address:                 d.Address,
		Phone:                   d.Phone,
		Type:                    d.Type,
		FloorCount:              d.FloorCount,
		TotalRoomsTarget:        d.TotalRoomsTarget,
		TotalCapacity:           d.TotalCapacity,
		MonthlyPaymentBachelor:  d.MonthlyPaymentBachelor,
		MonthlyPaymentMaster:    d.MonthlyPaymentMaster,
		MonthlyPaymentDoctorate: d.MonthlyPaymentDoctorate,
		YearlyPaymentBachelor:   d.YearlyPaymentBachelor,
		YearlyPaymentMaster:     d.YearlyPaymentMaster,
		YearlyPaymentDoctorate:  d.YearlyPaymentDoctorate,
		BuiltYear:               d.BuiltYear,
		CommissionedYear:        d.CommissionedYear,
		ObjectID:                d.ObjectID,
		ObjectName:              d.ObjectName,
		OwnershipForm:           d.OwnershipForm,
		ClosedForApplications:   d.ClosedForApplications,
		Latitude:                d.Latitude,
		Longitude:               d.Longitude,
		CreatedBy:               d.CreatedBy,
		CreatedAt:               d.CreatedAt,
		UpdatedAt:               d.UpdatedAt,
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
	ProvisionedBeds  int       `json:"provisioned_beds"`
	TotalRoomsTarget *int      `json:"total_rooms_target"`
	RoomsCreated     int       `json:"rooms_created"`
}

func dormitoryCapacityDTO(c *domain.DormitoryCapacity) dormitoryCapacityResponse {
	return dormitoryCapacityResponse{
		DormitoryID:      c.DormitoryID,
		TotalCapacity:    c.TotalCapacity,
		AllocatedBeds:    c.AllocatedBeds,
		ProvisionedBeds:  c.ProvisionedBeds,
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
	ID             uuid.UUID `json:"id"`
	DormitoryID    uuid.UUID `json:"dormitory_id"`
	DocumentID     uuid.UUID `json:"document_id"`
	DocumentNameKk string    `json:"document_name_kk"`
	DocumentNameRu string    `json:"document_name_ru"`
	CreatedAt      time.Time `json:"created_at"`
}

func dormitoryRequiredDocumentDTO(d *domain.DormitoryRequiredDocument) dormitoryRequiredDocumentResponse {
	return dormitoryRequiredDocumentResponse{ID: d.ID, DormitoryID: d.DormitoryID, DocumentID: d.DocumentID, DocumentNameKk: d.DocumentNameKk, DocumentNameRu: d.DocumentNameRu, CreatedAt: d.CreatedAt}
}

func dormitoryRequiredDocumentsDTO(list []*domain.DormitoryRequiredDocument) []dormitoryRequiredDocumentResponse {
	out := make([]dormitoryRequiredDocumentResponse, 0, len(list))
	for _, d := range list {
		out = append(out, dormitoryRequiredDocumentDTO(d))
	}
	return out
}

type requiredDocumentResponse struct {
	ID           uuid.UUID `json:"id"`
	NameKk       string    `json:"name_kk"`
	NameRu       string    `json:"name_ru"`
	ValidityDays *int      `json:"validity_days"`
	CreatedAt    time.Time `json:"created_at"`
}

func requiredDocumentDTO(d *domain.RequiredDocument) requiredDocumentResponse {
	return requiredDocumentResponse{ID: d.ID, NameKk: d.NameKk, NameRu: d.NameRu, ValidityDays: d.ValidityDays, CreatedAt: d.CreatedAt}
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
	FloorID      uuid.UUID               `json:"floor_id"`
	FloorName    *string                 `json:"floor_name"`
	RoomNumber   string                  `json:"room_number"`
	Capacity     int                     `json:"capacity"`
	Floor        *int                    `json:"floor"`
	Category     string                  `json:"category"`
	Restrictions domain.RoomRestrictions `json:"restrictions"`

	AreaSqM            *float64 `json:"area_sq_m"`
	Equipment          *string  `json:"equipment"`
	SanitaryConditions *string  `json:"sanitary_conditions"`
	IsAccessible       *bool    `json:"is_accessible"`
	AccessibilityNotes *string  `json:"accessibility_notes"`
	PhotoURLs          []string `json:"photo_urls"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func roomDTO(r *domain.Room) roomResponse {
	photoURLs := r.PhotoURLs
	if photoURLs == nil {
		photoURLs = []string{}
	}
	return roomResponse{
		ID:           r.ID,
		DormitoryID:  r.DormitoryID,
		FloorID:      r.FloorID,
		FloorName:    r.FloorName,
		RoomNumber:   r.RoomNumber,
		Capacity:     r.Capacity,
		Floor:        r.Floor,
		Category:     r.Category,
		Restrictions: r.Restrictions,

		AreaSqM:            r.AreaSqM,
		Equipment:          r.Equipment,
		SanitaryConditions: r.SanitaryConditions,
		IsAccessible:       r.IsAccessible,
		AccessibilityNotes: r.AccessibilityNotes,
		PhotoURLs:          photoURLs,

		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
}

func roomsDTO(list []*domain.Room) []roomResponse {
	out := make([]roomResponse, 0, len(list))
	for _, r := range list {
		out = append(out, roomDTO(r))
	}
	return out
}

type roomAvailabilityResponse struct {
	roomResponse
	ResidentCount     int `json:"resident_count"`
	HeldCount         int `json:"held_count"`
	OutOfServiceCount int `json:"out_of_service_count"`
}

func roomAvailabilityDTO(a *domain.RoomAvailability) roomAvailabilityResponse {
	return roomAvailabilityResponse{
		roomResponse:      roomDTO(a.Room),
		ResidentCount:     a.ResidentCount,
		HeldCount:         a.HeldCount,
		OutOfServiceCount: a.OutOfServiceCount,
	}
}

func roomsAvailabilityDTO(list []*domain.RoomAvailability) []roomAvailabilityResponse {
	out := make([]roomAvailabilityResponse, 0, len(list))
	for _, a := range list {
		out = append(out, roomAvailabilityDTO(a))
	}
	return out
}

type roomResidentResponse struct {
	ID         uuid.UUID  `json:"id"`
	RoomID     uuid.UUID  `json:"room_id"`
	StudentID  uuid.UUID  `json:"student_id"`
	BedID      *uuid.UUID `json:"bed_id"`
	BedLabel   *string    `json:"bed_label"`
	BedCode    *string    `json:"bed_code"`
	MovedInAt  time.Time  `json:"moved_in_at"`
	MovedOutAt *time.Time `json:"moved_out_at"`
}

func roomResidentDTO(rr *domain.RoomResident) roomResidentResponse {
	return roomResidentResponse{
		ID: rr.ID, RoomID: rr.RoomID, StudentID: rr.StudentID,
		BedID: rr.BedID, BedLabel: rr.BedLabel, BedCode: bedCodePtr(rr.BedInventoryNo),
		MovedInAt: rr.MovedInAt, MovedOutAt: rr.MovedOutAt,
	}
}

func bedCodePtr(inventoryNo *int64) *string {
	if inventoryNo == nil {
		return nil
	}
	code := domain.BedCode(*inventoryNo)
	return &code
}

type bedResponse struct {
	ID          uuid.UUID  `json:"id"`
	InventoryNo int64      `json:"inventory_no"`
	Code        string     `json:"code"`
	RoomID      uuid.UUID  `json:"room_id"`
	Label       string     `json:"label"`
	CreatedAt   time.Time  `json:"created_at"`
	RetiredAt   *time.Time `json:"retired_at"`
	// The current stay on this bed; both nil when the bed is free.
	ResidentID *uuid.UUID `json:"resident_id"`
	StudentID  *uuid.UUID `json:"student_id"`
	// free | reserved | occupied | repair | unavailable.
	Status domain.BedStatus `json:"status"`
	// The active application holding this bed; both nil when none.
	HeldApplicationID *uuid.UUID `json:"held_application_id"`
	HeldStudentID     *uuid.UUID `json:"held_student_id"`
	// Set while the bed is under repair or unavailable. ServiceUntil is the
	// expected date it is back (YYYY-MM-DD).
	ServiceReason    *string    `json:"service_reason"`
	ServiceUntil     *string    `json:"service_until"`
	ServiceChangedAt *time.Time `json:"service_changed_at"`
	ServiceChangedBy *uuid.UUID `json:"service_changed_by"`
}

func bedDTO(b *domain.Bed) bedResponse {
	return bedResponse{
		ID: b.ID, InventoryNo: b.InventoryNo, Code: domain.BedCode(b.InventoryNo),
		RoomID: b.RoomID, Label: b.Label, CreatedAt: b.CreatedAt, RetiredAt: b.RetiredAt,
		ResidentID: b.ResidentID, StudentID: b.StudentID,
		Status:            b.Status(),
		HeldApplicationID: b.HeldApplicationID, HeldStudentID: b.HeldStudentID,
		ServiceReason: b.ServiceReason, ServiceUntil: datePtr(b.ServiceUntil),
		ServiceChangedAt: b.ServiceChangedAt, ServiceChangedBy: b.ServiceChangedBy,
	}
}

// datePtr formats a DATE column as YYYY-MM-DD.
func datePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.DateOnly)
	return &s
}

type bedStatusChangeResponse struct {
	ID        uuid.UUID        `json:"id"`
	OldStatus domain.BedStatus `json:"old_status"`
	NewStatus domain.BedStatus `json:"new_status"`
	Reason    *string          `json:"reason"`
	Until     *string          `json:"until"`
	// nil = the system (e.g. a scheduled job), or unknown when backfilled.
	ChangedBy *uuid.UUID `json:"changed_by"`
	ChangedAt time.Time  `json:"changed_at"`
	// The document behind the change: application, reservation, contract,
	// exit_request, transfer_request (basis_id = that record) or act
	// (act_*). May be null on backfilled entries.
	BasisType  *domain.BedBasisType `json:"basis_type"`
	BasisID    *uuid.UUID           `json:"basis_id"`
	ActNumber  *string              `json:"act_number"`
	ActDate    *string              `json:"act_date"`
	ActFileURL *string              `json:"act_file_url"`
	StudentID  *uuid.UUID           `json:"student_id"`
	// Rebuilt from data older than the log (author/basis may be unknown).
	Backfilled bool `json:"backfilled"`
}

type bedStatusHistoryResponse struct {
	Bed     bedResponse               `json:"bed"`
	Changes []bedStatusChangeResponse `json:"changes"`
}

func bedStatusHistoryDTO(bed *domain.Bed, changes []*domain.BedStatusChange) bedStatusHistoryResponse {
	out := bedStatusHistoryResponse{Bed: bedDTO(bed), Changes: make([]bedStatusChangeResponse, 0, len(changes))}
	for _, c := range changes {
		out.Changes = append(out.Changes, bedStatusChangeResponse{
			ID: c.ID, OldStatus: c.OldStatus, NewStatus: c.NewStatus, Reason: c.Reason,
			Until: datePtr(c.Until), ChangedBy: c.ChangedBy, ChangedAt: c.ChangedAt,
			BasisType: c.BasisType, BasisID: c.BasisID, ActNumber: c.ActNumber,
			ActDate: datePtr(c.ActDate), ActFileURL: c.ActFileURL, StudentID: c.StudentID,
			Backfilled: c.Backfilled,
		})
	}
	return out
}

func bedsDTO(list []*domain.Bed) []bedResponse {
	out := make([]bedResponse, 0, len(list))
	for _, b := range list {
		out = append(out, bedDTO(b))
	}
	return out
}

type bedHistoryResponse struct {
	Bed   bedResponse            `json:"bed"`
	Stays []roomResidentResponse `json:"stays"`
}

func roomResidentsDTO(list []*domain.RoomResident) []roomResidentResponse {
	out := make([]roomResidentResponse, 0, len(list))
	for _, rr := range list {
		out = append(out, roomResidentDTO(rr))
	}
	return out
}

type benefitResponse struct {
	ID            uuid.UUID `json:"id"`
	NameKk        string    `json:"name_kk"`
	NameRu        string    `json:"name_ru"`
	DescriptionKk string    `json:"description_kk"`
	DescriptionRu string    `json:"description_ru"`
	Priority      int       `json:"priority"`
	CreatedBy     uuid.UUID `json:"created_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func benefitDTO(b *domain.Benefit) benefitResponse {
	return benefitResponse{
		ID: b.ID, NameKk: b.NameKk, NameRu: b.NameRu,
		DescriptionKk: b.DescriptionKk, DescriptionRu: b.DescriptionRu,
		Priority: b.Priority, CreatedBy: b.CreatedBy, CreatedAt: b.CreatedAt, UpdatedAt: b.UpdatedAt,
	}
}

func benefitsDTO(list []*domain.Benefit) []benefitResponse {
	out := make([]benefitResponse, 0, len(list))
	for _, b := range list {
		out = append(out, benefitDTO(b))
	}
	return out
}

type benefitRequiredDocumentResponse struct {
	ID             uuid.UUID `json:"id"`
	BenefitID      uuid.UUID `json:"benefit_id"`
	DocumentID     uuid.UUID `json:"document_id"`
	DocumentNameKk string    `json:"document_name_kk"`
	DocumentNameRu string    `json:"document_name_ru"`
	CreatedAt      time.Time `json:"created_at"`
}

func benefitRequiredDocumentDTO(d *domain.BenefitRequiredDocument) benefitRequiredDocumentResponse {
	return benefitRequiredDocumentResponse{ID: d.ID, BenefitID: d.BenefitID, DocumentID: d.DocumentID, DocumentNameKk: d.DocumentNameKk, DocumentNameRu: d.DocumentNameRu, CreatedAt: d.CreatedAt}
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
