package service

import (
	"testing"
	"time"

	"student-house/internal/domain"
)

func TestCheckReasons(t *testing.T) {
	today := time.Date(2026, 10, 16, 0, 0, 0, 0, time.UTC)
	days := func(n int) *int { return &n }
	ok := domain.DocumentCheckResult{Readable: true, MatchesExpectedType: true, NamesStudent: domain.NameMatchYes, IssueDate: "2026-09-01"}

	cases := []struct {
		name     string
		status   domain.DocumentCheckStatus
		validity *int
		mutate   func(r *domain.DocumentCheckResult)
		want     []domain.TriageReasonCode
	}{
		{name: "clean", status: domain.DocumentCheckDone, want: nil},
		{name: "still checking", status: domain.DocumentCheckPending, mutate: func(r *domain.DocumentCheckResult) { r.ForgerySigns = true }, want: nil},
		{name: "failed check needs a person", status: domain.DocumentCheckFailed, want: []domain.TriageReasonCode{domain.TriageCheckFailed}},
		{name: "unsupported file", status: domain.DocumentCheckUnsupported, want: []domain.TriageReasonCode{domain.TriageUnsupportedFormat}},
		{name: "unreadable hides everything else", status: domain.DocumentCheckDone, mutate: func(r *domain.DocumentCheckResult) { r.Readable = false; r.ForgerySigns = true }, want: []domain.TriageReasonCode{domain.TriageDocumentUnreadable}},
		{name: "wrong type", status: domain.DocumentCheckDone, mutate: func(r *domain.DocumentCheckResult) { r.MatchesExpectedType = false }, want: []domain.TriageReasonCode{domain.TriageWrongDocumentType}},
		{name: "within validity", status: domain.DocumentCheckDone, validity: days(90), want: nil},
		{name: "expired", status: domain.DocumentCheckDone, validity: days(30), want: []domain.TriageReasonCode{domain.TriageDocumentExpired}},
		{name: "expires today is still valid", status: domain.DocumentCheckDone, validity: days(45), want: nil},
		{name: "no issue date can't expire", status: domain.DocumentCheckDone, validity: days(1), mutate: func(r *domain.DocumentCheckResult) { r.IssueDate = "" }, want: nil},
		{name: "relative's document", status: domain.DocumentCheckDone, mutate: func(r *domain.DocumentCheckResult) { r.NamesStudent = domain.NameMatchNotApplicable }, want: nil},
		{name: "someone else", status: domain.DocumentCheckDone, mutate: func(r *domain.DocumentCheckResult) { r.NamesStudent = domain.NameMatchNo }, want: []domain.TriageReasonCode{domain.TriageNameMismatch}},
		{name: "forgery and expired", status: domain.DocumentCheckDone, validity: days(10), mutate: func(r *domain.DocumentCheckResult) { r.ForgerySigns = true }, want: []domain.TriageReasonCode{domain.TriageSuspectedForgery, domain.TriageDocumentExpired}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := ok
			if tc.mutate != nil {
				tc.mutate(&r)
			}
			got := checkReasons(&domain.DocumentCheck{Status: tc.status, Result: &r, ValidityDays: tc.validity}, today)
			if len(got) != len(tc.want) {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
			for i := range got {
				if got[i].Code != tc.want[i] {
					t.Fatalf("reason %d: got %s, want %s", i, got[i].Code, tc.want[i])
				}
			}
		})
	}
}

func TestCampaignStart(t *testing.T) {
	for in, want := range map[string]string{
		"2026-10-16T12:00:00Z": "2026-07-30",
		"2026-07-29T12:00:00Z": "2025-07-30",
		// 19:30 UTC on Jul 29 is already Jul 30 in Kyzylorda (UTC+5).
		"2026-07-29T19:30:00Z": "2026-07-30",
	} {
		now, _ := time.Parse(time.RFC3339, in)
		if got := campaignStart(now).Format(time.DateOnly); got != want {
			t.Errorf("campaignStart(%s) = %s, want %s", in, got, want)
		}
	}
}
