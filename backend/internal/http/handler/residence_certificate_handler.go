package handler

import (
	"time"

	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/response"
)

type ResidenceCertificateHandler struct {
	certificates *service.ResidenceCertificateService
}

func NewResidenceCertificateHandler(certificates *service.ResidenceCertificateService) *ResidenceCertificateHandler {
	return &ResidenceCertificateHandler{certificates: certificates}
}

// Unlike an invalid referral, a certificate keeps showing what it certified
// after the student moves out: it was true on the day it was issued, and the
// verifier needs those facts to compare. The IIN is left out of the public
// answer, though: the paper already carries it, and a QR link gets passed on.
type residenceCertificateResponse struct {
	Number           int       `json:"number"`
	Token            string    `json:"token"`
	StudentFullName  string    `json:"student_full_name"`
	IIN              string    `json:"iin,omitempty"`
	Institute        string    `json:"institute"`
	StudyGroup       string    `json:"study_group"`
	Course           *int16    `json:"course"`
	DormitoryName    string    `json:"dormitory_name"`
	DormitoryAddress string    `json:"dormitory_address"`
	RoomNumber       string    `json:"room_number"`
	MovedInAt        time.Time `json:"moved_in_at"`
	SignatoryName    string    `json:"signatory_name"`
	IssuedAt         time.Time `json:"issued_at"`
	StillResides     bool      `json:"still_resides"`
}

func residenceCertificateDTO(c *domain.ResidenceCertificate, withIIN bool) residenceCertificateResponse {
	dto := residenceCertificateResponse{
		Number: c.Number, Token: c.Token, StudentFullName: c.StudentFullName, Institute: c.Institute,
		StudyGroup: c.StudyGroup, Course: c.Course, DormitoryName: c.DormitoryName,
		DormitoryAddress: c.DormitoryAddress, RoomNumber: c.RoomNumber, MovedInAt: c.MovedInAt,
		SignatoryName: c.SignatoryName, IssuedAt: c.IssuedAt, StillResides: c.StillResides,
	}
	if withIIN {
		dto.IIN = c.IIN
	}
	return dto
}

// Verify is the public endpoint behind the QR code. Whether the student still
// lives there changes the moment they move, so nothing may keep a copy.
func (h *ResidenceCertificateHandler) Verify(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	certificate, err := h.certificates.GetByToken(c.Request.Context(), c.Param("token"))
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, residenceCertificateDTO(certificate, false))
}

func (h *ResidenceCertificateHandler) GetMine(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	certificate, err := h.certificates.GetMine(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, residenceCertificateDTO(certificate, true))
}

func (h *ResidenceCertificateHandler) Issue(c *gin.Context) {
	studentID, _ := middleware.UserID(c)
	certificate, err := h.certificates.Issue(c.Request.Context(), studentID)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, residenceCertificateDTO(certificate, true))
}
