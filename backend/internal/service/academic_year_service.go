package service

import (
	"context"
	"time"

	"student-house/internal/repository"
)

// rolloverMonth/rolloverDay is the fixed academic-calendar cutoff: course
// advances/graduation happen from July 30 onward each year.
const (
	rolloverMonth = time.July
	rolloverDay   = 30
)

// RolloverResult reports one academic year's worth of course-rollover
// activity.
type RolloverResult struct {
	Year      int
	Graduated int64
	Advanced  int64
}

// AcademicYearService runs the yearly course rollover: every July 30,
// students below their academic degree's max course (see
// domain.AcademicDegree.MaxCourse) advance by one course, and students
// already at max course graduate (blocked from logging in, same as a
// rejected registration).
//
// Rather than firing once at a precise instant — which a down server could
// simply miss — Run is meant to be called repeatedly (ticker or manual
// trigger). It's cheap and safe to call at any time: it compares today
// against the cutoff and against academic_year_rollover_state's
// last_rolled_over_year, so it only ever actually mutates data once per
// academic year, however late it ends up running, and self-heals through
// any number of missed years by replaying one year at a time.
type AcademicYearService struct {
	repo repository.AcademicYearRepository
	now  func() time.Time
}

func NewAcademicYearService(repo repository.AcademicYearRepository) *AcademicYearService {
	return &AcademicYearService{repo: repo, now: time.Now}
}

// Run checks whether the rollover is due and applies it if so. On a fresh
// deployment (rollover has never run) it only baselines
// last_rolled_over_year to the current effective academic year without
// touching any data — so installing this feature mid-cycle doesn't
// immediately bump everyone's course; the first real rollover fires on the
// next July 30. Returns one RolloverResult per academic year actually
// applied (usually zero or one; more than one only after an extended
// outage spanning multiple July 30ths).
func (s *AcademicYearService) Run(ctx context.Context) ([]RolloverResult, error) {
	effectiveYear := effectiveAcademicYear(s.now())

	last, err := s.repo.LastRolledOverYear(ctx)
	if err != nil {
		return nil, err
	}

	if last == nil {
		if _, err := s.repo.BaselineIfUnset(ctx, effectiveYear); err != nil {
			return nil, err
		}
		return nil, nil
	}

	var results []RolloverResult
	for year := *last + 1; year <= effectiveYear; year++ {
		graduated, advanced, applied, err := s.repo.RolloverCourses(ctx, year)
		if err != nil {
			return results, err
		}
		if applied {
			results = append(results, RolloverResult{Year: year, Graduated: graduated, Advanced: advanced})
		}
	}
	return results, nil
}

// effectiveAcademicYear returns the calendar year of the most recent July
// 30 cutoff at or before now — i.e. the academic year currently in effect.
func effectiveAcademicYear(now time.Time) int {
	cutoff := time.Date(now.Year(), rolloverMonth, rolloverDay, 0, 0, 0, 0, now.Location())
	if now.Before(cutoff) {
		return now.Year() - 1
	}
	return now.Year()
}
