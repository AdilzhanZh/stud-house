package domain

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleAdmin   Role = "admin"
	RoleStudent Role = "student"
	// RoleUser is staff with read-only access to dormitories by default.
	// "Manager" is no longer a role but a position (User.IsManager) admin
	// grants on top of it, which unlocks full management access.
	RoleUser Role = "user"
)

func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleStudent, RoleUser:
		return true
	default:
		return false
	}
}

// ApprovalStatus gates student login: a self-registered student starts
// Pending and cannot log in until a manager/admin approves them. Non-student
// roles (created directly by an admin) are always Approved.
type ApprovalStatus string

const (
	ApprovalPending  ApprovalStatus = "pending"
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalRejected ApprovalStatus = "rejected"
	// ApprovalGraduated is set by AcademicYearService's yearly course
	// rollover once a student's course would pass their academic degree's
	// MaxCourse — they've finished the program and can no longer log in,
	// same as ApprovalRejected but with its own message.
	ApprovalGraduated ApprovalStatus = "graduated"
)

type User struct {
	ID           uuid.UUID
	FullName     string
	Email        string
	Phone        string
	IIN          *string
	PasswordHash string
	Role         Role
	// IsManager, IsCommitteeMember and IsChairperson are admin-assigned
	// positions, only meaningful for role=user — none is a separate role.
	// IsChairperson is a further flag on top of IsCommitteeMember (at most
	// one true at a time, enforced by a DB partial unique index).
	IsManager         bool
	IsCommitteeMember bool
	IsChairperson     bool
	ApprovalStatus    ApprovalStatus
	AvatarURL         *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// CanManage reports whether a user with this role/position combination has
// full management access: the admin, or a user holding the manager position.
func CanManage(role Role, isManager bool) bool {
	return role == RoleAdmin || (role == RoleUser && isManager)
}

type Gender string

const (
	GenderMale   Gender = "male"
	GenderFemale Gender = "female"
)

func (g Gender) Valid() bool {
	switch g {
	case GenderMale, GenderFemale:
		return true
	default:
		return false
	}
}

// AcademicDegree records which program a student is enrolled in.
type AcademicDegree string

const (
	DegreeBachelor  AcademicDegree = "bachelor"
	DegreeMaster    AcademicDegree = "master"
	DegreeDoctorate AcademicDegree = "doctorate"
)

func (d AcademicDegree) Valid() bool {
	switch d {
	case DegreeBachelor, DegreeMaster, DegreeDoctorate:
		return true
	default:
		return false
	}
}

// MaxCourse returns the highest valid course number for this degree:
// bachelor's programs run 4 years, master's run 2, doctoral run 3.
func (d AcademicDegree) MaxCourse() int16 {
	switch d {
	case DegreeMaster:
		return 2
	case DegreeDoctorate:
		return 3
	default:
		return 4
	}
}

// StudentProfile holds the attributes (gender, course, academic degree) that
// room restriction validation checks against; only meaningful for users with
// RoleStudent.
type StudentProfile struct {
	UserID         uuid.UUID
	Gender         *Gender
	Course         *int16
	AcademicDegree *AcademicDegree
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
