package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"student-house/internal/domain"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type registerRequest struct {
	FullName       string                `json:"full_name" binding:"required"`
	Email          string                `json:"email" binding:"required,email"`
	Phone          string                `json:"phone"`
	IIN            string                `json:"iin" binding:"required"`
	Password       string                `json:"password" binding:"required"`
	Gender         domain.Gender         `json:"gender" binding:"required"`
	Course         int16                 `json:"course" binding:"required"`
	AcademicDegree domain.AcademicDegree `json:"academic_degree" binding:"required"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	user, err := h.auth.RegisterStudent(c.Request.Context(), req.FullName, req.Email, req.Phone, req.Password, req.IIN, req.Gender, req.Course, req.AcademicDegree)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, userDTO(user))
}

type verifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required"`
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req verifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.auth.VerifyEmail(c.Request.Context(), req.Email, req.Code); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"verified": true})
}

type resendVerificationRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func (h *AuthHandler) ResendVerification(c *gin.Context) {
	var req resendVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.auth.ResendVerificationCode(c.Request.Context(), req.Email); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"sent": true})
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type tokenResponse struct {
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	User         interface{} `json:"user"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	pair, user, err := h.auth.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, tokenResponse{AccessToken: pair.AccessToken, RefreshToken: pair.RefreshToken, User: userDTO(user)})
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	pair, err := h.auth.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"access_token": pair.AccessToken, "refresh_token": pair.RefreshToken})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.auth.Logout(c.Request.Context(), req.RefreshToken); err != nil {
		response.Error(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
