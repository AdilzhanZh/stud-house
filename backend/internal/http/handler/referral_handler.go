package handler

import (
	"time"

	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/response"
)

type ReferralHandler struct {
	referrals *service.ReferralService
}

func NewReferralHandler(referrals *service.ReferralService) *ReferralHandler {
	return &ReferralHandler{referrals: referrals}
}

// referralResponse leaves everything about the student empty on an invalid
// referral: whoever scans an old paper only needs to learn it no longer holds.
type referralResponse struct {
	Number           int       `json:"number"`
	Token            string    `json:"token"`
	Valid            bool      `json:"valid"`
	IssuedAt         time.Time `json:"issued_at"`
	ProtocolNumber   int       `json:"protocol_number"`
	StudentFullName  string    `json:"student_full_name"`
	Institute        string    `json:"institute"`
	StudyGroup       string    `json:"study_group"`
	DormitoryName    string    `json:"dormitory_name"`
	DormitoryAddress string    `json:"dormitory_address"`
	RoomNumber       string    `json:"room_number"`
	SignatoryName    string    `json:"signatory_name"`
}

func referralDTO(r *domain.Referral) referralResponse {
	dto := referralResponse{Number: r.Number, Token: r.Token, Valid: r.Valid, IssuedAt: r.IssuedAt}
	if r.Valid {
		dto.ProtocolNumber = r.ProtocolNumber
		dto.StudentFullName = r.StudentFullName
		dto.Institute = r.Institute
		dto.StudyGroup = r.StudyGroup
		dto.DormitoryName = r.DormitoryName
		dto.DormitoryAddress = r.DormitoryAddress
		dto.RoomNumber = r.RoomNumber
		dto.SignatoryName = r.SignatoryName
	}
	return dto
}

// Verify is the public endpoint behind the QR code. The answer changes the
// moment a student moves, so nothing along the way may keep a copy.
func (h *ReferralHandler) Verify(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	referral, err := h.referrals.GetByToken(c.Request.Context(), c.Param("token"))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, referralDTO(referral))
}

func (h *ReferralHandler) GetMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	referral, err := h.referrals.GetMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, referralDTO(referral))
}
