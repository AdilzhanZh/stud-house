package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

type memUserRepo struct {
	repository.UserRepository
	user        domain.User
	phoneWrites int
}

func (r *memUserRepo) GetByID(context.Context, uuid.UUID) (*domain.User, error) {
	u := r.user
	return &u, nil
}

func (r *memUserRepo) UpdatePhone(_ context.Context, _ uuid.UUID, phone string) error {
	r.phoneWrites++
	r.user.Phone = phone
	return nil
}

type memProfileRepo struct {
	repository.StudentProfileRepository
	profile       *domain.StudentProfile
	detailsWrites int
}

func (r *memProfileRepo) GetByUserID(context.Context, uuid.UUID) (*domain.StudentProfile, error) {
	if r.profile == nil {
		return nil, repository.ErrNotFound
	}
	p := *r.profile
	return &p, nil
}

func (r *memProfileRepo) UpdateDetails(_ context.Context, userID uuid.UUID, d domain.StudentDetails) error {
	r.detailsWrites++
	if r.profile == nil {
		r.profile = &domain.StudentProfile{UserID: userID}
	}
	r.profile.StudentDetails = d
	return nil
}

func ptr(s string) *string { return &s }

func newDetailsService(role domain.Role, profile *domain.StudentProfile) (*UserService, *memUserRepo, *memProfileRepo) {
	users := &memUserRepo{user: domain.User{ID: uuid.New(), Role: role, Phone: "+77001112233"}}
	profiles := &memProfileRepo{profile: profile}
	return NewUserService(users, profiles, nil), users, profiles
}

func TestUpdateStudentDetailsKeepsOmittedFields(t *testing.T) {
	s, users, profiles := newDetailsService(domain.RoleStudent, &domain.StudentProfile{
		StudentDetails: domain.StudentDetails{Institute: "Жаратылыстану", StudyGroup: "ИС-21-2", Hometown: "Жалағаш"},
	})

	user, profile, err := s.UpdateStudentDetails(context.Background(), users.user.ID, StudentDetailsInput{
		StudyGroup:    ptr("  ИС-22-1 "),
		ParentContact: ptr("+77019998877"),
	})
	if err != nil {
		t.Fatal(err)
	}
	want := domain.StudentDetails{Institute: "Жаратылыстану", StudyGroup: "ИС-22-1", Hometown: "Жалағаш", ParentContact: "+77019998877"}
	if profile.StudentDetails != want {
		t.Errorf("details = %+v, want %+v", profile.StudentDetails, want)
	}
	if user.Phone != "+77001112233" || users.phoneWrites != 0 {
		t.Errorf("an omitted phone must not be written: phone %q, writes %d", user.Phone, users.phoneWrites)
	}
	if profiles.detailsWrites != 1 {
		t.Errorf("details writes = %d, want 1", profiles.detailsWrites)
	}
}

func TestUpdateStudentDetailsCreatesMissingProfile(t *testing.T) {
	s, users, _ := newDetailsService(domain.RoleStudent, nil)
	_, profile, err := s.UpdateStudentDetails(context.Background(), users.user.ID, StudentDetailsInput{Hometown: ptr("Арал")})
	if err != nil {
		t.Fatal(err)
	}
	if profile.Hometown != "Арал" {
		t.Errorf("hometown = %q", profile.Hometown)
	}
}

func TestUpdateStudentDetailsSavesPhone(t *testing.T) {
	s, users, profiles := newDetailsService(domain.RoleStudent, &domain.StudentProfile{})
	user, _, err := s.UpdateStudentDetails(context.Background(), users.user.ID, StudentDetailsInput{Phone: ptr(" +77015554433 ")})
	if err != nil {
		t.Fatal(err)
	}
	if user.Phone != "+77015554433" {
		t.Errorf("phone = %q", user.Phone)
	}
	if profiles.detailsWrites != 0 {
		t.Errorf("unchanged details must not be written, got %d writes", profiles.detailsWrites)
	}
}

func TestUpdateStudentDetailsRejectsBadInputBeforeWriting(t *testing.T) {
	for name, in := range map[string]StudentDetailsInput{
		"blank phone":         {Phone: ptr("   "), StudyGroup: ptr("ИС-22-1")},
		"long phone":          {Phone: ptr(strings.Repeat("1", domain.MaxPhoneLength+1))},
		"long institute":      {Institute: ptr(strings.Repeat("и", domain.MaxInstituteLength+1))},
		"long study group":    {StudyGroup: ptr(strings.Repeat("г", domain.MaxStudyGroupLength+1))},
		"long hometown":       {Hometown: ptr(strings.Repeat("ж", domain.MaxHometownLength+1))},
		"long parent contact": {ParentContact: ptr(strings.Repeat("7", domain.MaxParentContactLength+1)), StudyGroup: ptr("ИС-22-1")},
	} {
		s, users, profiles := newDetailsService(domain.RoleStudent, &domain.StudentProfile{})
		_, _, err := s.UpdateStudentDetails(context.Background(), users.user.ID, in)
		var appErr *apperror.AppError
		if !errors.As(err, &appErr) {
			t.Errorf("%s: want an apperror, got %v", name, err)
		}
		if users.phoneWrites != 0 || profiles.detailsWrites != 0 {
			t.Errorf("%s: nothing may be written when validation fails", name)
		}
	}
}

func TestUpdateStudentDetailsOnlyForStudents(t *testing.T) {
	s, users, _ := newDetailsService(domain.RoleUser, nil)
	if _, _, err := s.UpdateStudentDetails(context.Background(), users.user.ID, StudentDetailsInput{Hometown: ptr("Арал")}); err == nil {
		t.Fatal("want an error for a non-student account")
	}
}
