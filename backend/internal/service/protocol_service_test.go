package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/pkg/apperror"
)

func newIDs(n int) []uuid.UUID {
	ids := make([]uuid.UUID, n)
	for i := range ids {
		ids[i] = uuid.New()
	}
	return ids
}

// Repositories are left nil: each of these must be rejected before any is used.
func TestProtocolCreateRejectsInvalidStudentCounts(t *testing.T) {
	tests := []struct {
		name         string
		applications []uuid.UUID
		residents    []uuid.UUID
	}{
		{name: "no students"},
		{name: "over the limit in one list", residents: newIDs(domain.MaxProtocolStudents + 1)},
		{name: "over the limit across both lists", applications: newIDs(300), residents: newIDs(201)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := (&ProtocolService{}).Create(context.Background(), uuid.New(), tt.applications, tt.residents)
			var appErr *apperror.AppError
			if !errors.As(err, &appErr) {
				t.Fatalf("want an apperror, got %v", err)
			}
		})
	}
}

func TestUniqueIDsCollapsesDuplicates(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	got := uniqueIDs([]uuid.UUID{a, b, a, a})
	if len(got) != 2 || got[0] != a || got[1] != b {
		t.Fatalf("got %v", got)
	}
}
