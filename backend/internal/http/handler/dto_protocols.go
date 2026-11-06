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

type protocolCandidateResponse struct {
	ApplicationID   *uuid.UUID `json:"application_id"`
	StudentID       uuid.UUID  `json:"student_id"`
	StudentFullName string     `json:"student_full_name"`
	DormitoryID     uuid.UUID  `json:"dormitory_id"`
	DormitoryName   string     `json:"dormitory_name"`
	RoomNumber      *string    `json:"room_number"`
	StudyGroup      string     `json:"study_group"`
}

func protocolCandidatesDTO(list []*domain.ProtocolCandidate) []protocolCandidateResponse {
	out := make([]protocolCandidateResponse, 0, len(list))
	for _, c := range list {
		out = append(out, protocolCandidateResponse{
			ApplicationID:   c.ApplicationID,
			StudentID:       c.StudentID,
			StudentFullName: c.StudentFullName,
			DormitoryID:     c.DormitoryID,
			DormitoryName:   c.DormitoryName,
			RoomNumber:      c.RoomNumber,
			StudyGroup:      c.StudyGroup,
		})
	}
	return out
}

// protocolStudentResponse describes an approved applicant or, with the
// application and dormitory id fields null, a current resident.
type protocolStudentResponse struct {
	ApplicationID     *uuid.UUID `json:"application_id"`
	ApplicationStatus *string    `json:"application_status"`
	StudentID         uuid.UUID  `json:"student_id"`
	StudentFullName   string     `json:"student_full_name"`
	StudentEmail      string     `json:"student_email"`
	StudentPhone      string     `json:"student_phone"`
	DormitoryID       *uuid.UUID `json:"dormitory_id"`
	DormitoryName     string     `json:"dormitory_name"`
	AssignedRoomID    *uuid.UUID `json:"assigned_room_id"`
	RoomNumber        *string    `json:"room_number"`
	StudyGroup        string     `json:"study_group"`
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
	students := make([]protocolStudentResponse, 0, len(d.Applications)+len(d.Residents))
	for _, app := range d.Applications {
		student := d.Students[app.StudentID]
		applicationStatus := string(app.Status)
		row := protocolStudentResponse{
			ApplicationID:     &app.ID,
			ApplicationStatus: &applicationStatus,
			StudentID:         app.StudentID,
			DormitoryID:       &app.DormitoryID,
			AssignedRoomID:    app.AssignedRoomID,
			StudyGroup:        app.StudyGroup,
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
	for _, res := range d.Residents {
		students = append(students, protocolStudentResponse{
			StudentID:       res.StudentID,
			StudentFullName: res.FullName,
			StudentEmail:    res.Email,
			StudentPhone:    res.Phone,
			DormitoryName:   res.DormitoryName,
			RoomNumber:      &res.RoomNumber,
			StudyGroup:      res.StudyGroup,
		})
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
