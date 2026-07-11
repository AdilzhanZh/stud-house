package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/http/middleware"
	"student-house/internal/service"
	"student-house/pkg/apperror"
	"student-house/pkg/response"
)

type UserHandler struct {
	users *service.UserService
}

func NewUserHandler(users *service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

type createUserRequest struct {
	FullName string      `json:"full_name" binding:"required"`
	Email    string      `json:"email" binding:"required,email"`
	Phone    string      `json:"phone"`
	Password string      `json:"password" binding:"required"`
	Role     domain.Role `json:"role" binding:"required"`
}

// CreateUser is admin-only: registers a user with any role (including admin).
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	user, err := h.users.CreateUser(c.Request.Context(), req.FullName, req.Email, req.Phone, req.Password, req.Role)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.Created(c, userDTO(user))
}

type updateRoleRequest struct {
	Role domain.Role `json:"role" binding:"required"`
}

// UpdateRole is admin-only.
func (h *UserHandler) UpdateRole(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.users.UpdateRole(c.Request.Context(), id, req.Role); err != nil {
		response.Error(c, err)
		return
	}
	user, err := h.users.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, userDTO(user))
}

type setCommitteeMemberRequest struct {
	IsCommitteeMember bool `json:"is_committee_member"`
}

// SetCommitteeMember is admin-only — elects (or removes) a manager onto the
// committee.
func (h *UserHandler) SetCommitteeMember(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	var req setCommitteeMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.users.SetCommitteeMember(c.Request.Context(), id, req.IsCommitteeMember); err != nil {
		response.Error(c, err)
		return
	}
	user, err := h.users.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, userDTO(user))
}

type setChairpersonRequest struct {
	IsChairperson bool `json:"is_chairperson"`
}

// SetChairperson is admin-only.
func (h *UserHandler) SetChairperson(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	var req setChairpersonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.users.SetChairperson(c.Request.Context(), id, req.IsChairperson); err != nil {
		response.Error(c, err)
		return
	}
	user, err := h.users.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, userDTO(user))
}

// ListCommitteeMembers returns every user with is_committee_member = true,
// for the chairperson-assignment picker. Admin and manager may both view it.
func (h *UserHandler) ListCommitteeMembers(c *gin.Context) {
	users, err := h.users.ListCommitteeMembers(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, usersDTO(users))
}

// List is admin/manager-only: the admin panel's user table, optionally
// filtered by ?role=.
func (h *UserHandler) List(c *gin.Context) {
	var role *domain.Role
	if raw := c.Query("role"); raw != "" {
		r := domain.Role(raw)
		if !r.Valid() {
			response.Error(c, apperror.BadRequest("рөл фильтрі дұрыс емес"))
			return
		}
		role = &r
	}
	users, err := h.users.List(c.Request.Context(), role)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, usersDTO(users))
}

// ListPendingStudents is admin/manager-only: self-registered students
// awaiting approval before they can log in.
func (h *UserHandler) ListPendingStudents(c *gin.Context) {
	users, err := h.users.ListPendingStudents(c.Request.Context())
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, usersDTO(users))
}

type decideStudentApprovalRequest struct {
	Action string `json:"action" binding:"required"`
}

// DecideStudentApproval is admin/manager-only: action is "approve" or "reject".
func (h *UserHandler) DecideStudentApproval(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	var req decideStudentApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	var approve bool
	switch req.Action {
	case "approve":
		approve = true
	case "reject":
		approve = false
	default:
		response.Error(c, apperror.BadRequest("action \"approve\" немесе \"reject\" болуы керек"))
		return
	}
	if err := h.users.DecideStudentApproval(c.Request.Context(), id, approve); err != nil {
		response.Error(c, err)
		return
	}
	user, err := h.users.GetByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, userDTO(user))
}

type upsertStudentProfileRequest struct {
	Gender         *domain.Gender         `json:"gender"`
	Course         *int16                 `json:"course"`
	AcademicDegree *domain.AcademicDegree `json:"academic_degree"`
}

// UpsertStudentProfile is allowed for admin/manager (any student) or the
// student themselves (their own profile only).
func (h *UserHandler) UpsertStudentProfile(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	if !canAccessStudentResource(c, id) {
		response.Error(c, apperror.Forbidden("тек өз профиліңізді ғана басқара аласыз"))
		return
	}

	var req upsertStudentProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.users.UpsertStudentProfile(c.Request.Context(), id, req.Gender, req.Course, req.AcademicDegree); err != nil {
		response.Error(c, err)
		return
	}
	profile, err := h.users.GetStudentProfile(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, studentProfileDTO(profile))
}

func (h *UserHandler) GetStudentProfile(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	if !canAccessStudentResource(c, id) {
		response.Error(c, apperror.Forbidden("тек өз профиліңізді ғана көре аласыз"))
		return
	}
	profile, err := h.users.GetStudentProfile(c.Request.Context(), id)
	if err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, studentProfileDTO(profile))
}

type setPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required"`
}

// SetPassword is admin-only: resets any user's password. There is no
// corresponding "get password" endpoint — passwords are one-way hashed and
// genuinely cannot be viewed, only reset.
func (h *UserHandler) SetPassword(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	var req setPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, apperror.BadRequest(err.Error()))
		return
	}
	if err := h.users.SetUserPassword(c.Request.Context(), id, req.NewPassword); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"updated": true})
}

// DeleteUser is admin-only. An admin cannot delete their own account.
func (h *UserHandler) DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, apperror.BadRequest("пайдаланушы идентификаторы дұрыс емес"))
		return
	}
	if currentID, ok := middleware.UserID(c); ok && currentID == id {
		response.Error(c, apperror.BadRequest("өз аккаунтыңызды жоя алмайсыз"))
		return
	}
	if err := h.users.DeleteUser(c.Request.Context(), id); err != nil {
		response.Error(c, err)
		return
	}
	response.OK(c, gin.H{"deleted": true})
}

// canAccessStudentResource allows admins and managers unconditionally, and a
// student only when accessing their own resource.
func canAccessStudentResource(c *gin.Context, targetID uuid.UUID) bool {
	role, _ := middleware.Role(c)
	if role == domain.RoleAdmin || role == domain.RoleManager {
		return true
	}
	userID, ok := middleware.UserID(c)
	return ok && userID == targetID
}
