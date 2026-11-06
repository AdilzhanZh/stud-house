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
	iinWrites   int
}

const takenIIN = "990101000001"

func (r *memUserRepo) GetByID(context.Context, uuid.UUID) (*domain.User, error) {
	u := r.user
	return &u, nil
}

func (r *memUserRepo) UpdateIIN(_ context.Context, _ uuid.UUID, iin string) error {
	if iin == takenIIN {
		return repository.ErrConflict
	}
	r.iinWrites++
	r.user.IIN = &iin
	return nil
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
	courseWrites  int
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

func (r *memProfileRepo) Upsert(_ context.Context, p *domain.StudentProfile) error {
	r.courseWrites++
	if r.profile == nil {
		r.profile = &domain.StudentProfile{UserID: p.UserID}
	}
	r.profile.Gender, r.profile.Course, r.profile.AcademicDegree = p.Gender, p.Course, p.AcademicDegree
	return nil
}

func ptr(s string) *string { return &s }

func course(n int16) *int16 { return &n }

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

func TestUpdateStudentDetailsFillsMissingIINAndCourse(t *testing.T) {
	master := domain.DegreeMaster
	s, users, profiles := newDetailsService(domain.RoleStudent, &domain.StudentProfile{AcademicDegree: &master})
	user, profile, err := s.UpdateStudentDetails(context.Background(), users.user.ID, StudentDetailsInput{
		IIN:    ptr(" 990101000002 "),
		Course: course(2),
	})
	if err != nil {
		t.Fatal(err)
	}
	if user.IIN == nil || *user.IIN != "990101000002" {
		t.Errorf("iin = %v", user.IIN)
	}
	if profile.Course == nil || *profile.Course != 2 || profiles.courseWrites != 1 {
		t.Errorf("course = %v, writes %d", profile.Course, profiles.courseWrites)
	}
	if profile.AcademicDegree == nil || *profile.AcademicDegree != domain.DegreeMaster {
		t.Errorf("saving the course must keep the degree, got %v", profile.AcademicDegree)
	}
}

func TestUpdateStudentDetailsAcceptsUnchangedIINAndCourse(t *testing.T) {
	s, users, profiles := newDetailsService(domain.RoleStudent, &domain.StudentProfile{Course: course(3)})
	users.user.IIN = ptr("990101000003")
	if _, _, err := s.UpdateStudentDetails(context.Background(), users.user.ID, StudentDetailsInput{
		IIN: ptr("990101000003"), Course: course(3),
	}); err != nil {
		t.Fatal(err)
	}
	if users.iinWrites != 0 || profiles.courseWrites != 0 {
		t.Errorf("unchanged values must not be written: iin %d, course %d", users.iinWrites, profiles.courseWrites)
	}
}

func TestUpdateStudentDetailsGuardsIINAndCourse(t *testing.T) {
	master := domain.DegreeMaster
	for name, tc := range map[string]struct {
		iin     *string
		profile domain.StudentProfile
		in      StudentDetailsInput
		status  int
	}{
		"changing a recorded IIN": {iin: ptr("990101000003"), in: StudentDetailsInput{IIN: ptr("990101000004")}, status: 400},
		"IIN too short":           {in: StudentDetailsInput{IIN: ptr("12345")}, status: 400},
		"IIN with letters":        {in: StudentDetailsInput{IIN: ptr("99010100000a")}, status: 400},
		"IIN already taken":       {in: StudentDetailsInput{IIN: ptr(takenIIN), Hometown: ptr("Арал")}, status: 409},
		"changing a recorded course": {
			profile: domain.StudentProfile{Course: course(2)}, in: StudentDetailsInput{Course: course(3)}, status: 400,
		},
		"course past the degree": {
			profile: domain.StudentProfile{AcademicDegree: &master}, in: StudentDetailsInput{Course: course(3)}, status: 400,
		},
		"course zero": {in: StudentDetailsInput{Course: course(0)}, status: 400},
	} {
		profile := tc.profile
		s, users, profiles := newDetailsService(domain.RoleStudent, &profile)
		users.user.IIN = tc.iin
		_, _, err := s.UpdateStudentDetails(context.Background(), users.user.ID, tc.in)
		var appErr *apperror.AppError
		if !errors.As(err, &appErr) || appErr.Status != tc.status {
			t.Errorf("%s: want status %d, got %v", name, tc.status, err)
			continue
		}
		if users.iinWrites != 0 || profiles.courseWrites != 0 || profiles.detailsWrites != 0 {
			t.Errorf("%s: nothing may be written when refused", name)
		}
	}
}
