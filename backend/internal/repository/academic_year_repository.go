package repository

import "context"

// AcademicYearRepository backs AcademicYearService's yearly course
// rollover, backed by the academic_year_rollover_state singleton
// (migration 000075).
type AcademicYearRepository interface {
	// LastRolledOverYear returns the academic year the rollover last ran
	// for, or nil if it has never run (fresh deployment).
	LastRolledOverYear(ctx context.Context) (*int, error)
	// BaselineIfUnset sets last_rolled_over_year to year, but only if it's
	// still NULL — used on a service's very first run so deploying this
	// feature mid-cycle doesn't immediately roll everyone's course forward;
	// the first real rollover only fires on the next July 30 after that.
	// Returns whether it actually set the value (false if already set).
	BaselineIfUnset(ctx context.Context, year int) (bool, error)
	// RolloverCourses atomically (a) graduates every approved student whose
	// course has already reached their academic degree's max course
	// (users.approval_status -> 'graduated', course left untouched), (b)
	// advances everyone else's course by one, and (c) advances
	// last_rolled_over_year to year — all inside one transaction guarded by
	// a row lock on the singleton, so concurrent callers (background ticker
	// racing a manual admin trigger) can't double-apply it. If
	// last_rolled_over_year is already >= year, it's a no-op and applied is
	// false.
	RolloverCourses(ctx context.Context, year int) (graduated int64, advanced int64, applied bool, err error)
}
