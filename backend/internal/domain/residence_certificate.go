package domain

import (
	"time"

	"github.com/google/uuid"
)

// ResidenceCertificate ("Анықтама") certifies that a student lived in a
// dormitory room on the day it was issued. Everything printed on it is a
// snapshot taken then; only StillResides is worked out on every read: whether
// the stay it certifies (one room_residents row) hasn't ended since.
type ResidenceCertificate struct {
	ID               uuid.UUID
	Number           int
	Token            string
	StudentID        uuid.UUID
	StudentFullName  string
	IIN              string
	Institute        string
	StudyGroup       string
	Course           *int16
	DormitoryName    string
	DormitoryAddress string
	RoomNumber       string
	MovedInAt        time.Time
	SignatoryName    string
	IssuedAt         time.Time
	StillResides     bool
}
