package notifier

import (
	"testing"

	"github.com/google/uuid"

	"student-house/internal/domain"
)

func TestPushURL(t *testing.T) {
	appID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	for name, tc := range map[string]struct {
		role domain.Role
		app  *uuid.UUID
		want string
	}{
		"student with an application": {domain.RoleStudent, &appID, "/applications/" + appID.String()},
		"student without one":         {domain.RoleStudent, nil, "/notifications"},
		// Staff have no /applications/:id page of their own to land on.
		"staff": {domain.RoleUser, &appID, "/notifications"},
	} {
		if got := pushURL(tc.role, tc.app); got != tc.want {
			t.Errorf("%s: got %q, want %q", name, got, tc.want)
		}
	}
}
