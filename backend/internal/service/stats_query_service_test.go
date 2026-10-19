package service

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TestStatsQueryConfinement checks that generated SQL can only read the
// stats_* views. It needs a migrated database whose user may ALTER the
// stats_reader role: STATS_TEST_DATABASE_URL=postgres://… go test -run Stats ./internal/service/
func TestStatsQueryConfinement(t *testing.T) {
	url := os.Getenv("STATS_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("STATS_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	main, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer main.Close()
	s := NewStatsQueryService(ctx, main, url)
	if !s.Enabled() {
		t.Fatal("stats queries did not start")
	}
	defer s.Close()

	if res, err := s.Run(ctx, "SELECT dormitory_name, SUM(applications) AS n FROM stats_applications GROUP BY 1;"); err != nil {
		t.Fatalf("aggregate query failed: %v", err)
	} else if len(res.Columns) != 2 {
		t.Fatalf("unexpected columns %v", res.Columns)
	}

	denied := map[string]string{
		"base table":         "SELECT full_name FROM users",
		"base table via CTE": "WITH x AS (SELECT iin FROM users) SELECT * FROM x",
		"role escalation":    "SELECT set_config('role', current_setting('is_superuser'), false), (SELECT count(*) FROM users)",
		"switch back role":   "SELECT set_config('role', 'student_house', false)",
		"write via CTE":      "WITH d AS (DELETE FROM assistant_messages RETURNING id) SELECT count(*) FROM d",
		"write via function": "SELECT set_config('default_transaction_read_only', 'off', false), (SELECT count(*) FROM ai_settings)",
		"second statement":   "SELECT 1; DELETE FROM applications",
		"not a select":       "DELETE FROM applications",
		"file read":          "SELECT pg_read_file('/etc/passwd')",
	}
	for name, q := range denied {
		if _, err := s.Run(ctx, q); err == nil {
			t.Errorf("%s: query was allowed: %s", name, q)
		} else if testing.Verbose() {
			t.Logf("%s: denied: %v", name, strings.SplitN(err.Error(), "\n", 2)[0])
		}
	}
}
