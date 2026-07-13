package domain

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleAdmin   Role = "admin"
	RoleStudent Role = "student"
	RoleManager Role = "manager"
)

func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleStudent, RoleManager:
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
)

type User struct {
	ID           uuid.UUID
	FullName     string
	Email        string
	Phone        string
	IIN          *string
	PasswordHash string
	Role         Role
	// IsCommitteeMember is admin-toggled, only meaningful for role=manager —
	// committee membership is an elected flag on top of the manager role,
	// not a separate role. IsChairperson is a further flag on top of that
	// (at most one true at a time, enforced by a DB partial unique index).
	IsCommitteeMember          bool
	IsChairperson              bool
	ApprovalStatus             ApprovalStatus
	AvatarURL                  *string
	EmailVerifiedAt            *time.Time
	EmailVerificationCode      *string
	EmailVerificationExpiresAt *time.Time
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
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
	DegreeBachelor AcademicDegree = "bachelor"
	DegreeMaster   AcademicDegree = "master"
)

func (d AcademicDegree) Valid() bool {
	switch d {
	case DegreeBachelor, DegreeMaster:
		return true
	default:
		return false
	}
}

// MaxCourse returns the highest valid course number for this degree:
// bachelor's programs run 4 years, master's run 2.
func (d AcademicDegree) MaxCourse() int16 {
	if d == DegreeMaster {
		return 2
	}
	return 4
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
