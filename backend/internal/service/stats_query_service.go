package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	statsQueryMaxRows = 200
	statsQueryTimeout = 10 * time.Second
)

// StatsQueryService runs read-only SQL written by the assistant against
// the aggregate stats_* views, for ad-hoc statistics questions and reports.
//
// Safety does not rely on inspecting the SQL. Queries run over a separate
// connection pool logged in as stats_reader (see the reporting-views
// migration): a role that can SELECT the stats_* views and nothing else,
// with read-only transactions and a statement timeout. Logging in as it —
// rather than SET ROLE on the main, privileged connection — matters: a
// query could otherwise switch the role back with set_config('role', …).
// stats_reader's password is random per process start and never stored.
type StatsQueryService struct {
	pool *pgxpool.Pool
}

// NewStatsQueryService enables stats_reader with a fresh password (main
// must be allowed to ALTER that role) and opens its pool. On failure it
// returns a disabled service rather than an error: statistics questions
// are an optional feature.
func NewStatsQueryService(ctx context.Context, main *pgxpool.Pool, databaseURL string) *StatsQueryService {
	s := &StatsQueryService{}
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		log.Printf("stats queries disabled: %v", err)
		return s
	}
	password := hex.EncodeToString(buf) // hex: safe to inline in the DDL below
	if _, err := main.Exec(ctx, `ALTER ROLE stats_reader WITH LOGIN PASSWORD '`+password+`'`); err != nil {
		log.Printf("stats queries disabled: cannot enable stats_reader: %v", err)
		return s
	}
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		log.Printf("stats queries disabled: %v", err)
		return s
	}
	cfg.ConnConfig.User = "stats_reader"
	cfg.ConnConfig.Password = password
	cfg.MaxConns = 2
	// Also set on the role itself by the migration; repeated here so the
	// limits hold even if the role's defaults were changed.
	cfg.ConnConfig.RuntimeParams["default_transaction_read_only"] = "on"
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = "5000"
	cfg.ConnConfig.RuntimeParams["search_path"] = "public"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err == nil {
		err = pool.Ping(ctx)
	}
	if err != nil {
		log.Printf("stats queries disabled: cannot connect as stats_reader: %v", err)
		return s
	}
	s.pool = pool
	return s
}

func (s *StatsQueryService) Enabled() bool { return s != nil && s.pool != nil }

type StatsQueryResult struct {
	Columns   []string `json:"columns"`
	Rows      [][]any  `json:"rows"`
	Truncated bool     `json:"truncated"`
}

// Run executes one SELECT and returns at most statsQueryMaxRows rows. The
// checks here only give the model clear errors to correct; the database
// role is what actually confines the query.
func (s *StatsQueryService) Run(ctx context.Context, sql string) (*StatsQueryResult, error) {
	if !s.Enabled() {
		return nil, errors.New("statistics queries are not available on this server")
	}
	q := strings.TrimSpace(sql)
	q = strings.TrimSpace(strings.TrimSuffix(q, ";"))
	lower := strings.ToLower(q)
	if !strings.HasPrefix(lower, "select") && !strings.HasPrefix(lower, "with") {
		return nil, errors.New("only a single SELECT (or WITH … SELECT) query is allowed")
	}
	if strings.Contains(q, ";") {
		return nil, errors.New("only one statement is allowed; remove the semicolons")
	}

	ctx, cancel := context.WithTimeout(ctx, statsQueryTimeout)
	defer cancel()
	rows, err := s.pool.Query(ctx, fmt.Sprintf("SELECT * FROM (%s) AS stats_query LIMIT %d", q, statsQueryMaxRows+1))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := &StatsQueryResult{Rows: [][]any{}}
	for _, f := range rows.FieldDescriptions() {
		out.Columns = append(out.Columns, f.Name)
	}
	for rows.Next() {
		if len(out.Rows) == statsQueryMaxRows {
			out.Truncated = true
			break
		}
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		for i, v := range vals {
			vals[i] = jsonValue(v)
		}
		out.Rows = append(out.Rows, vals)
	}
	return out, rows.Err()
}

// jsonValue turns driver values into plain JSON-friendly ones.
func jsonValue(v any) any {
	switch x := v.(type) {
	case time.Time:
		if x.Hour() == 0 && x.Minute() == 0 && x.Second() == 0 {
			return x.Format(time.DateOnly)
		}
		return x.Format(time.RFC3339)
	case pgtype.Numeric:
		if f, err := x.Float64Value(); err == nil && f.Valid {
			return f.Float64
		}
		return nil
	case *big.Int:
		return x.String()
	case []byte:
		return string(x)
	default:
		return v
	}
}

func (s *StatsQueryService) Close() {
	if s.Enabled() {
		s.pool.Close()
	}
}
