package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"student-house/internal/domain"
)

func NewPool(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	cfg.PrepareConn = prepareBedLogSettings
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// bedLogDirty marks a connection whose app.bed_* settings were set by an
// earlier request and must be cleared before the next one.
const bedLogDirty = "bedlog"

// prepareBedLogSettings copies the request's domain.BedLogContext (author,
// basis, act) into the connection's app.bed_* settings when the connection
// is taken from the pool, where the bed status log triggers (migration
// 000101) read them. Connections are cleared again for requests without
// one, so nothing leaks between requests. Requests without a context on a
// clean connection cost nothing.
func prepareBedLogSettings(ctx context.Context, conn *pgx.Conn) (bool, error) {
	info := domain.BedLogFrom(ctx)
	data := conn.PgConn().CustomData()
	if info == nil && data[bedLogDirty] == nil {
		return true, nil
	}

	var actor, basisType, basisID, actNumber, actDate, actFile string
	if info != nil {
		if info.ActorID != nil {
			actor = info.ActorID.String()
		}
		basisType = string(info.BasisType)
		if info.BasisID != nil {
			basisID = info.BasisID.String()
		}
		if info.Act != nil {
			actNumber = info.Act.Number
			actDate = info.Act.Date.Format(time.DateOnly)
			if info.Act.FileURL != nil {
				actFile = *info.Act.FileURL
			}
		}
	}
	_, err := conn.Exec(ctx, `SELECT
		set_config('app.bed_actor', $1, false),
		set_config('app.bed_basis_type', $2, false),
		set_config('app.bed_basis_id', $3, false),
		set_config('app.bed_act_number', $4, false),
		set_config('app.bed_act_date', $5, false),
		set_config('app.bed_act_file_url', $6, false)`,
		actor, basisType, basisID, actNumber, actDate, actFile)
	if err != nil {
		return false, err
	}
	if info != nil {
		data[bedLogDirty] = true
	} else {
		delete(data, bedLogDirty)
	}
	return true, nil
}
