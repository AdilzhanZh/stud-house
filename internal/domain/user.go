package domain

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleAdmin           Role = "admin"
	RoleStudent         Role = "student"
	RoleManager         Role = "manager"
	RoleCommitteeMember Role = "committee_member"
)

func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleStudent, RoleManager, RoleCommitteeMember:
		return true
	default:
		return false
	}
}

type User struct {
	ID            uuid.UUID
	FullName      string
	Email         string
	Phone         string
	PasswordHash  string
	Role          Role
	IsChairperson bool
	CreatedAt     time.Time
	UpdatedAt     time.Time
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

// StudentProfile holds the attributes (gender, course) that room restriction
// validation checks against; only meaningful for users with RoleStudent.
type StudentProfile struct {
	UserID    uuid.UUID
	Gender    *Gender
	Course    *int16
	CreatedAt time.Time
	UpdatedAt time.Time
}
