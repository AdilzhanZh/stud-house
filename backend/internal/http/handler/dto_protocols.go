package handler

import (
	"time"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/service"
)

type protocolResponse struct {
	ID        uuid.UUID `json:"id"`
	Number    int       `json:"number"`
	Status    string    `json:"status"`
	CreatedBy uuid.UUID `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func protocolDTO(p *domain.Protocol) protocolResponse {
	return protocolResponse{
		ID:        p.ID,
		Number:    p.Number,
		Status:    string(p.Status),
		CreatedBy: p.CreatedBy,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
}

func protocolsDTO(list []*domain.Protocol) []protocolResponse {
	out := make([]protocolResponse, 0, len(list))
	for _, p := range list {
		out = append(out, protocolDTO(p))
	}
	return out
}

type protocolStudentResponse struct {
	ApplicationID     uuid.UUID  `json:"application_id"`
	ApplicationStatus string     `json:"application_status"`
	StudentID         uuid.UUID  `json:"student_id"`
	StudentFullName   string     `json:"student_full_name"`
	StudentEmail      string     `json:"student_email"`
	StudentPhone      string     `json:"student_phone"`
	DormitoryID       uuid.UUID  `json:"dormitory_id"`
	DormitoryName     string     `json:"dormitory_name"`
	AssignedRoomID    *uuid.UUID `json:"assigned_room_id"`
	RoomNumber        *string    `json:"room_number"`
}

type committeeVoteResponse struct {
	CommitteeMemberID   uuid.UUID  `json:"committee_member_id"`
	CommitteeMemberName string     `json:"committee_member_name"`
	Decision            *string    `json:"decision"`
	Reason              *string    `json:"reason"`
	VotedAt             *time.Time `json:"voted_at"`
}

type protocolDetailResponse struct {
	protocolResponse
	Students []protocolStudentResponse `json:"students"`
	Votes    []committeeVoteResponse   `json:"votes"`
}

func protocolDetailDTO(d *service.ProtocolDetail) protocolDetailResponse {
	students := make([]protocolStudentResponse, 0, len(d.Applications))
	for _, app := range d.Applications {
		student := d.Students[app.StudentID]
		row := protocolStudentResponse{
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
		if dormitory := d.Dormitories[app.DormitoryID]; dormitory != nil {
			row.DormitoryName = dormitory.Name
		}
		if app.AssignedRoomID != nil {
			if room := d.Rooms[*app.AssignedRoomID]; room != nil {
				row.RoomNumber = &room.RoomNumber
			}
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

	return protocolDetailResponse{
		protocolResponse: protocolDTO(d.Protocol),
		Students:         students,
		Votes:            votes,
	}
}
