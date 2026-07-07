package handler

import (
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/service"
)

type reportTemplateResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	FileURL   string    `json:"file_url"`
	CreatedBy uuid.UUID `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
}

func reportTemplateDTO(t *domain.ReportTemplate) reportTemplateResponse {
	return reportTemplateResponse{ID: t.ID, Name: t.Name, FileURL: t.FileURL, CreatedBy: t.CreatedBy, CreatedAt: t.CreatedAt}
}

func reportTemplatesDTO(list []*domain.ReportTemplate) []reportTemplateResponse {
	out := make([]reportTemplateResponse, 0, len(list))
	for _, t := range list {
		out = append(out, reportTemplateDTO(t))
	}
	return out
}

type reportResponse struct {
	ID               uuid.UUID  `json:"id"`
	TemplateID       uuid.UUID  `json:"template_id"`
	CreatedBy        uuid.UUID  `json:"created_by"`
	Status           string     `json:"status"`
	PreviousReportID *uuid.UUID `json:"previous_report_id"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

func reportDTO(r *domain.Report) reportResponse {
	return reportResponse{
		ID:               r.ID,
		TemplateID:       r.TemplateID,
		CreatedBy:        r.CreatedBy,
		Status:           string(r.Status),
		PreviousReportID: r.PreviousReportID,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
	}
}

func reportsDTO(list []*domain.Report) []reportResponse {
	out := make([]reportResponse, 0, len(list))
	for _, r := range list {
		out = append(out, reportDTO(r))
	}
	return out
}

type reportStudentResponse struct {
	ApplicationID     uuid.UUID  `json:"application_id"`
	ApplicationStatus string     `json:"application_status"`
	StudentID         uuid.UUID  `json:"student_id"`
	StudentFullName   string     `json:"student_full_name"`
	StudentEmail      string     `json:"student_email"`
	StudentPhone      string     `json:"student_phone"`
	DormitoryID       uuid.UUID  `json:"dormitory_id"`
	AssignedRoomID    *uuid.UUID `json:"assigned_room_id"`
}

type committeeVoteResponse struct {
	CommitteeMemberID   uuid.UUID  `json:"committee_member_id"`
	CommitteeMemberName string     `json:"committee_member_name"`
	Decision            *string    `json:"decision"`
	Reason              *string    `json:"reason"`
	VotedAt             *time.Time `json:"voted_at"`
}

type reportDetailResponse struct {
	reportResponse
	Template reportTemplateResponse  `json:"template"`
	Students []reportStudentResponse `json:"students"`
	Votes    []committeeVoteResponse `json:"votes"`
}

func reportDetailDTO(d *service.ReportDetail) reportDetailResponse {
	students := make([]reportStudentResponse, 0, len(d.Applications))
	for _, app := range d.Applications {
		student := d.Students[app.StudentID]
		row := reportStudentResponse{
			ApplicationID:     app.ID,
			ApplicationStatus: string(app.Status),
			StudentID:         app.StudentID,
			DormitoryID:       app.DormitoryID,
			AssignedRoomID:    app.AssignedRoomID,
		}
		if student != nil {
			row.StudentFullName = student.FullName
			row.StudentEmail = student.Email
			row.StudentPhone = student.Phone
		}
		students = append(students, row)
	}

	votes := make([]committeeVoteResponse, 0, len(d.Votes))
	for _, v := range d.Votes {
		member := d.CommitteeMembers[v.CommitteeMemberID]
		row := committeeVoteResponse{
			CommitteeMemberID: v.CommitteeMemberID,
			Reason:            v.Reason,
			VotedAt:           v.VotedAt,
		}
		if v.Decision != nil {
			dec := string(*v.Decision)
			row.Decision = &dec
		}
		if member != nil {
			row.CommitteeMemberName = member.FullName
		}
		votes = append(votes, row)
	}

	return reportDetailResponse{
		reportResponse: reportDTO(d.Report),
		Template:       reportTemplateDTO(d.Template),
		Students:       students,
		Votes:          votes,
	}
}
