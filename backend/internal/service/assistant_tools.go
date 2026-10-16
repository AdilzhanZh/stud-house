package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
)

// AssistantToolDeps is everything the assistant's read-only tools look up.
type AssistantToolDeps struct {
	Users            repository.UserRepository
	Profiles         repository.StudentProfileRepository
	Applications     repository.ApplicationRepository
	Dormitories      repository.DormitoryRepository
	Rooms            repository.RoomRepository
	Benefits         repository.BenefitRepository
	StudentBenefits  repository.StudentBenefitRepository
	Contracts        repository.ContractRepository
	Notifications    repository.NotificationRepository
	ExitRequests     repository.ExitRequestRepository
	TransferRequests repository.TransferRequestRepository
	Protocols        repository.ProtocolRepository
	CampaignStats    repository.CampaignStatsRepository
	Triage           *TriageService
	Campaign         *CampaignService
}

// assistantTools are the tools the assistant may call. Each tool only ever
// reads, and only what the calling user could see in the UI themselves —
// the tool set offered (definitions) and every call (run) are both checked
// against the caller's capabilities.
type assistantTools struct {
	d AssistantToolDeps
}

func NewAssistantTools(d AssistantToolDeps) *assistantTools {
	return &assistantTools{d: d}
}

type assistantTool struct {
	name        string
	description string
	properties  map[string]any
	required    []string
	allowed     func(assistantCaps) bool
	run         func(t *assistantTools, ctx context.Context, user *domain.User, input json.RawMessage) (any, error)
}

var (
	forStudent   = func(c assistantCaps) bool { return c.Student }
	forStaff     = func(c assistantCaps) bool { return !c.Student }
	forManager   = func(c assistantCaps) bool { return c.Manager }
	forCommittee = func(c assistantCaps) bool { return c.Committee }
	forEveryone  = func(assistantCaps) bool { return true }
)

// assistantToolList is in a fixed order: the tools array is part of the
// cached and replayed prompt prefix.
var assistantToolList = []assistantTool{
	{
		name:        "get_my_status",
		description: "The student's own situation: profile, every application (status, history with manager comments, documents still to upload and why), contract (status, response deadline), current room, and move-out / room-transfer requests. Call this before answering anything about their application, documents, contract or room.",
		allowed:     forStudent,
		run:         (*assistantTools).myStatus,
	},
	{
		name:        "get_my_notifications",
		description: "The student's 10 most recent in-app notifications.",
		allowed:     forStudent,
		run:         (*assistantTools).myNotifications,
	},
	{
		name:        "list_benefits",
		description: "All benefits (льготалар) a student can claim, with their descriptions, priority weight and required documents.",
		allowed:     forEveryone,
		run:         (*assistantTools).listBenefits,
	},
	{
		name:        "list_dormitories",
		description: "All dormitories: address, whether they accept applications, payment amounts, beds, residents, held and free seats, and the documents each one requires.",
		allowed:     forEveryone,
		run:         (*assistantTools).listDormitories,
	},
	{
		name:        "get_campaign_stats",
		description: "Aggregate intake-campaign progress: applications submitted/reviewed since the campaign start, how many are at each pipeline stage, green/yellow/red triage counts, daily submissions for 14 days, and seats per dormitory.",
		allowed:     forManager,
		run:         (*assistantTools).campaignStats,
	},
	{
		name:        "list_pending_applications",
		description: "Applications waiting for a manager decision, with student name, dormitory, submission date and triage color (green = ready, yellow = student must fix something, red = needs the manager's judgement) with reasons. Optionally filter by color.",
		properties: map[string]any{
			"color": map[string]any{"type": "string", "enum": []string{"any", "green", "yellow", "red"}, "description": "Triage color to filter by, or any."},
		},
		required: []string{"color"},
		allowed:  forManager,
		run:      (*assistantTools).pendingApplications,
	},
	{
		name:        "find_student",
		description: "Look up students by part of their name or by exact 12-digit IIN: contact details, course, account approval, latest application and current room. Returns at most 10 matches.",
		properties: map[string]any{
			"query": map[string]any{"type": "string", "description": "Part of the student's full name, or their exact IIN."},
		},
		required: []string{"query"},
		allowed:  forManager,
		run:      (*assistantTools).findStudent,
	},
	{
		name:        "list_contracts_needing_attention",
		description: "Contracts whose student response deadline has passed (waiting for the manager to extend or void them — those seats can be passed to the next in line) and contracts whose deadline is within the next 3 days.",
		allowed:     forManager,
		run:         (*assistantTools).contractsNeedingAttention,
	},
	{
		name:        "list_open_requests",
		description: "Pending move-out (шығу) and room-transfer (ауыстыру) requests from residents, with student names and reasons.",
		allowed:     forManager,
		run:         (*assistantTools).openRequests,
	},
	{
		name:        "list_my_protocol_votes",
		description: "Commission protocols still open for voting that this commission member belongs to, with how many applications each covers and whether they have voted yet.",
		allowed:     forCommittee,
		run:         (*assistantTools).myProtocolVotes,
	},
}

func (t *assistantTools) definitions(c assistantCaps) []anthropic.BetaToolUnionParam {
	var out []anthropic.BetaToolUnionParam
	for _, tool := range assistantToolList {
		if !tool.allowed(c) {
			continue
		}
		props := tool.properties
		if props == nil {
			props = map[string]any{}
		}
		out = append(out, anthropic.BetaToolUnionParam{OfTool: &anthropic.BetaToolParam{
			Name:        tool.name,
			Description: anthropic.String(tool.description),
			Strict:      anthropic.Bool(true),
			InputSchema: anthropic.BetaToolInputSchemaParam{
				Properties:  props,
				Required:    tool.required,
				ExtraFields: map[string]any{"additionalProperties": false},
			},
		}})
	}
	return out
}

// openRouterDefinitions are the same tools in the OpenAI function format.
func (t *assistantTools) openRouterDefinitions(c assistantCaps) []orTool {
	var out []orTool
	for _, tool := range assistantToolList {
		if !tool.allowed(c) {
			continue
		}
		props := tool.properties
		if props == nil {
			props = map[string]any{}
		}
		schema := map[string]any{"type": "object", "properties": props, "additionalProperties": false}
		if len(tool.required) > 0 {
			schema["required"] = tool.required
		}
		out = append(out, orTool{Type: "function", Function: orToolFunction{
			Name:        tool.name,
			Description: tool.description,
			Parameters:  schema,
		}})
	}
	return out
}

// run executes one tool call and returns its result as JSON text, or an
// error message with isError set.
func (t *assistantTools) run(ctx context.Context, user *domain.User, c assistantCaps, name string, input any) (string, bool) {
	for _, tool := range assistantToolList {
		if tool.name != name {
			continue
		}
		if !tool.allowed(c) {
			return "this tool is not available to this user", true
		}
		raw, err := json.Marshal(input)
		if err != nil {
			return "invalid tool input", true
		}
		result, err := tool.run(t, ctx, user, raw)
		if err != nil {
			log.Printf("assistant tool %s failed: %v", name, err)
			return "lookup failed: " + err.Error(), true
		}
		out, err := json.Marshal(result)
		if err != nil {
			return "encoding result failed", true
		}
		return string(out), false
	}
	return "unknown tool " + name, true
}

func dateOnly(t time.Time) string { return t.In(kyzylorda).Format(time.DateOnly) }

func dateOnlyPtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := dateOnly(*t)
	return &s
}

// ---- student tools ----

type roomRef struct {
	Dormitory string `json:"dormitory"`
	Room      string `json:"room"`
	Floor     *int   `json:"floor,omitempty"`
}

func (t *assistantTools) roomRef(ctx context.Context, roomID uuid.UUID) (*roomRef, error) {
	room, err := t.d.Rooms.GetByID(ctx, roomID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, nil
		}
		return nil, err
	}
	ref := &roomRef{Room: room.RoomNumber, Floor: room.Floor}
	if d, err := t.d.Dormitories.GetByID(ctx, room.DormitoryID); err == nil {
		ref.Dormitory = d.Name
	}
	return ref, nil
}

func (t *assistantTools) dormitoryName(ctx context.Context, id uuid.UUID) string {
	if d, err := t.d.Dormitories.GetByID(ctx, id); err == nil {
		return d.Name
	}
	return ""
}

func (t *assistantTools) myStatus(ctx context.Context, user *domain.User, _ json.RawMessage) (any, error) {
	type historyEntry struct {
		Status  string  `json:"status"`
		At      string  `json:"at"`
		Comment *string `json:"comment,omitempty"`
	}
	type toUpload struct {
		Document string `json:"document"`
		Reason   string `json:"reason"`
		Detail   string `json:"detail,omitempty"`
	}
	type contractInfo struct {
		Status           string  `json:"status"`
		SentOn           string  `json:"sent_on"`
		ResponseDeadline string  `json:"response_deadline"`
		RespondedOn      *string `json:"responded_on,omitempty"`
	}
	type application struct {
		ID            uuid.UUID      `json:"id"`
		Dormitory     string         `json:"dormitory"`
		Status        string         `json:"status"`
		SubmittedOn   string         `json:"submitted_on"`
		PreferredRoom *roomRef       `json:"preferred_room,omitempty"`
		AssignedRoom  *roomRef       `json:"assigned_room,omitempty"`
		History       []historyEntry `json:"history"`
		ToUpload      []toUpload     `json:"documents_to_upload,omitempty"`
		Contract      *contractInfo  `json:"contract,omitempty"`
	}
	type request struct {
		Kind      string  `json:"kind"`
		Status    string  `json:"status"`
		CreatedOn string  `json:"created_on"`
		Reason    *string `json:"reason,omitempty"`
		Comment   *string `json:"manager_comment,omitempty"`
	}
	out := struct {
		FullName       string        `json:"full_name"`
		Course         *int16        `json:"course,omitempty"`
		AcademicDegree *string       `json:"academic_degree,omitempty"`
		Gender         *string       `json:"gender,omitempty"`
		Benefits       []string      `json:"benefits"`
		Applications   []application `json:"applications"`
		CurrentRoom    *roomRef      `json:"current_room"`
		MovedInOn      *string       `json:"moved_in_on,omitempty"`
		Requests       []request     `json:"requests"`
	}{FullName: user.FullName, Benefits: []string{}, Applications: []application{}, Requests: []request{}}

	if p, err := t.d.Profiles.GetByUserID(ctx, user.ID); err == nil {
		out.Course = p.Course
		if p.AcademicDegree != nil {
			s := string(*p.AcademicDegree)
			out.AcademicDegree = &s
		}
		if p.Gender != nil {
			s := string(*p.Gender)
			out.Gender = &s
		}
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	sbs, err := t.d.StudentBenefits.ListByStudent(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	for _, sb := range sbs {
		if b, err := t.d.Benefits.GetByID(ctx, sb.BenefitID); err == nil {
			out.Benefits = append(out.Benefits, b.NameKk)
		}
	}

	apps, err := t.d.Applications.ListByStudent(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	for _, a := range apps {
		app := application{ID: a.ID, Dormitory: t.dormitoryName(ctx, a.DormitoryID), Status: string(a.Status), SubmittedOn: dateOnly(a.CreatedAt), History: []historyEntry{}}
		if a.PreferredRoomID != nil {
			if app.PreferredRoom, err = t.roomRef(ctx, *a.PreferredRoomID); err != nil {
				return nil, err
			}
		}
		if a.AssignedRoomID != nil {
			if app.AssignedRoom, err = t.roomRef(ctx, *a.AssignedRoomID); err != nil {
				return nil, err
			}
		}
		hist, err := t.d.Applications.ListHistory(ctx, a.ID)
		if err != nil {
			return nil, err
		}
		for _, h := range hist {
			if h.ToStatus == domain.ApplicationManagerReview {
				continue // transient sub-state, never shown in the UI
			}
			app.History = append(app.History, historyEntry{Status: string(h.ToStatus), At: dateOnly(h.CreatedAt), Comment: h.Comment})
		}
		if a.Status == domain.ApplicationPending || a.Status == domain.ApplicationNeedsCorrection {
			fixes, err := t.d.Triage.StudentFixes(ctx, a.ID)
			if err != nil {
				return nil, err
			}
			for _, f := range fixes {
				app.ToUpload = append(app.ToUpload, toUpload{Document: f.NameKk, Reason: string(f.Reason), Detail: f.Detail})
			}
		}
		if c, err := t.d.Contracts.GetByApplicationID(ctx, a.ID); err == nil {
			app.Contract = &contractInfo{Status: string(c.Status), SentOn: dateOnly(c.SentAt), ResponseDeadline: c.ResponseDeadline.In(kyzylorda).Format("2006-01-02 15:04"), RespondedOn: dateOnlyPtr(c.RespondedAt)}
		} else if !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
		out.Applications = append(out.Applications, app)
	}

	if rr, err := t.d.Rooms.GetActiveResidentByStudent(ctx, user.ID); err == nil {
		if out.CurrentRoom, err = t.roomRef(ctx, rr.RoomID); err != nil {
			return nil, err
		}
		moved := dateOnly(rr.MovedInAt)
		out.MovedInOn = &moved
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	exits, err := t.d.ExitRequests.ListByStudent(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	for _, e := range exits {
		out.Requests = append(out.Requests, request{Kind: "move_out", Status: string(e.Status), CreatedOn: dateOnly(e.RequestedAt), Reason: e.Reason, Comment: e.Comment})
	}
	transfers, err := t.d.TransferRequests.ListByStudent(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	for _, tr := range transfers {
		out.Requests = append(out.Requests, request{Kind: "room_transfer", Status: string(tr.Status), CreatedOn: dateOnly(tr.CreatedAt), Reason: tr.Reason, Comment: tr.Comment})
	}
	return out, nil
}

func (t *assistantTools) myNotifications(ctx context.Context, user *domain.User, _ json.RawMessage) (any, error) {
	type notification struct {
		Title string `json:"title"`
		Body  string `json:"body"`
		On    string `json:"on"`
		Read  bool   `json:"read"`
	}
	list, err := t.d.Notifications.ListByUser(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	out := []notification{}
	for i, n := range list {
		if i == 10 {
			break
		}
		out = append(out, notification{Title: n.Title, Body: n.Body, On: dateOnly(n.CreatedAt), Read: n.IsRead})
	}
	return out, nil
}

// ---- shared tools ----

func (t *assistantTools) listBenefits(ctx context.Context, _ *domain.User, _ json.RawMessage) (any, error) {
	type benefit struct {
		Name              string   `json:"name"`
		NameRu            string   `json:"name_ru"`
		Description       string   `json:"description"`
		Priority          int      `json:"priority"`
		RequiredDocuments []string `json:"required_documents"`
	}
	list, err := t.d.Benefits.List(ctx)
	if err != nil {
		return nil, err
	}
	out := []benefit{}
	for _, b := range list {
		docs, err := t.d.Benefits.ListRequiredDocuments(ctx, b.ID)
		if err != nil {
			return nil, err
		}
		names := []string{}
		for _, d := range docs {
			names = append(names, d.DocumentNameKk)
		}
		out = append(out, benefit{Name: b.NameKk, NameRu: b.NameRu, Description: b.DescriptionKk, Priority: b.Priority, RequiredDocuments: names})
	}
	return out, nil
}

func (t *assistantTools) listDormitories(ctx context.Context, _ *domain.User, _ json.RawMessage) (any, error) {
	type dormitory struct {
		ID                    uuid.UUID `json:"id"`
		Name                  string    `json:"name"`
		Address               string    `json:"address"`
		Phone                 *string   `json:"phone,omitempty"`
		AcceptingApplications bool      `json:"accepting_applications"`
		MonthlyBachelor       *float64  `json:"monthly_payment_bachelor,omitempty"`
		MonthlyMaster         *float64  `json:"monthly_payment_master,omitempty"`
		MonthlyDoctorate      *float64  `json:"monthly_payment_doctorate,omitempty"`
		YearlyBachelor        *float64  `json:"yearly_payment_bachelor,omitempty"`
		YearlyMaster          *float64  `json:"yearly_payment_master,omitempty"`
		YearlyDoctorate       *float64  `json:"yearly_payment_doctorate,omitempty"`
		Beds                  int       `json:"beds_in_rooms"`
		Residents             int       `json:"residents"`
		HeldSeats             int       `json:"held_by_applications"`
		FreeSeats             int       `json:"free_seats"`
		RequiredDocuments     []string  `json:"required_documents"`
	}
	dorms, err := t.d.Dormitories.List(ctx, false)
	if err != nil {
		return nil, err
	}
	seats, err := t.d.CampaignStats.ListDormitorySeats(ctx)
	if err != nil {
		return nil, err
	}
	seatsByID := map[uuid.UUID]*domain.DormitorySeats{}
	for _, s := range seats {
		seatsByID[s.DormitoryID] = s
	}
	out := []dormitory{}
	for _, d := range dorms {
		docs, err := t.d.Dormitories.ListRequiredDocuments(ctx, d.ID)
		if err != nil {
			return nil, err
		}
		names := []string{}
		for _, doc := range docs {
			names = append(names, doc.DocumentNameKk)
		}
		item := dormitory{
			ID: d.ID, Name: d.Name, Address: d.Address, Phone: d.Phone, AcceptingApplications: !d.ClosedForApplications,
			MonthlyBachelor: d.MonthlyPaymentBachelor, MonthlyMaster: d.MonthlyPaymentMaster, MonthlyDoctorate: d.MonthlyPaymentDoctorate,
			YearlyBachelor: d.YearlyPaymentBachelor, YearlyMaster: d.YearlyPaymentMaster, YearlyDoctorate: d.YearlyPaymentDoctorate,
			RequiredDocuments: names,
		}
		if s := seatsByID[d.ID]; s != nil {
			item.Beds, item.Residents, item.HeldSeats, item.FreeSeats = s.RoomBeds, s.Residents, s.Held, s.FreeBeds
		}
		out = append(out, item)
	}
	return out, nil
}

// ---- manager tools ----

func (t *assistantTools) campaignStats(ctx context.Context, _ *domain.User, _ json.RawMessage) (any, error) {
	s, err := t.d.Campaign.Stats(ctx, time.Now())
	if err != nil {
		return nil, err
	}
	daily := map[string]int{}
	for _, d := range s.Daily {
		daily[d.Day.Format(time.DateOnly)] = d.Count
	}
	type dorm struct {
		Name           string `json:"name"`
		Submitted      int    `json:"submitted_this_campaign"`
		AwaitingReview int    `json:"awaiting_review"`
		Beds           int    `json:"beds_in_rooms"`
		Residents      int    `json:"residents"`
		Held           int    `json:"held"`
		Free           int    `json:"free"`
	}
	dorms := []dorm{}
	for _, d := range s.Dormitories {
		dorms = append(dorms, dorm{d.DormitoryName, d.Submitted, d.AwaitingReview, d.RoomBeds, d.Residents, d.Held, d.FreeBeds})
	}
	return map[string]any{
		"campaign_start":      s.CampaignStart.Format(time.DateOnly),
		"submitted":           s.Submitted,
		"reviewed":            s.Reviewed,
		"stages":              s.Stages,
		"triage_of_pending":   s.Triage,
		"daily_submissions":   daily,
		"dormitories":         dorms,
		"stage_count_meaning": "open stages (awaiting_*) count every application still waiting regardless of date; settled/rejected/contract_declined and submitted/reviewed count only since campaign_start",
	}, nil
}

func (t *assistantTools) pendingApplications(ctx context.Context, _ *domain.User, input json.RawMessage) (any, error) {
	var in struct {
		Color string `json:"color"`
	}
	_ = json.Unmarshal(input, &in)
	triage, err := t.d.Triage.ListPending(ctx)
	if err != nil {
		return nil, err
	}
	type reason struct {
		Code     string `json:"code"`
		Document string `json:"document,omitempty"`
		Detail   string `json:"detail,omitempty"`
	}
	type item struct {
		ApplicationID uuid.UUID `json:"application_id"`
		Student       string    `json:"student"`
		Dormitory     string    `json:"dormitory"`
		SubmittedOn   string    `json:"submitted_on"`
		Color         string    `json:"color"`
		AICheckActive bool      `json:"ai_check_in_progress"`
		Reasons       []reason  `json:"reasons"`
	}
	out := []item{}
	total := 0
	for _, tr := range triage {
		if in.Color != "" && in.Color != "any" && string(tr.Color) != in.Color {
			continue
		}
		total++
		if len(out) == 50 {
			continue
		}
		app, err := t.d.Applications.GetByID(ctx, tr.ApplicationID)
		if err != nil {
			return nil, err
		}
		it := item{ApplicationID: app.ID, Dormitory: t.dormitoryName(ctx, app.DormitoryID), SubmittedOn: dateOnly(app.CreatedAt), Color: string(tr.Color), AICheckActive: tr.Checking, Reasons: []reason{}}
		if u, err := t.d.Users.GetByID(ctx, app.StudentID); err == nil {
			it.Student = u.FullName
		}
		for _, r := range tr.Reasons {
			it.Reasons = append(it.Reasons, reason{Code: string(r.Code), Document: r.DocumentNameKk, Detail: r.Detail})
		}
		out = append(out, it)
	}
	return map[string]any{"total": total, "shown": len(out), "applications": out}, nil
}

func (t *assistantTools) findStudent(ctx context.Context, _ *domain.User, input json.RawMessage) (any, error) {
	var in struct {
		Query string `json:"query"`
	}
	_ = json.Unmarshal(input, &in)
	q := strings.ToLower(strings.TrimSpace(in.Query))
	if len([]rune(q)) < 2 {
		return nil, fmt.Errorf("query must be at least 2 characters")
	}
	role := domain.RoleStudent
	students, err := t.d.Users.List(ctx, &role)
	if err != nil {
		return nil, err
	}
	type latestApp struct {
		Status      string `json:"status"`
		Dormitory   string `json:"dormitory"`
		SubmittedOn string `json:"submitted_on"`
	}
	type match struct {
		FullName          string     `json:"full_name"`
		Email             string     `json:"email"`
		Phone             string     `json:"phone"`
		Course            *int16     `json:"course,omitempty"`
		AccountApproval   string     `json:"account_approval"`
		LatestApplication *latestApp `json:"latest_application"`
		CurrentRoom       *roomRef   `json:"current_room"`
	}
	out := []match{}
	for _, u := range students {
		byIIN := u.IIN != nil && *u.IIN == q
		if !byIIN && !strings.Contains(strings.ToLower(u.FullName), q) {
			continue
		}
		if len(out) == 10 {
			break
		}
		m := match{FullName: u.FullName, Email: u.Email, Phone: u.Phone, AccountApproval: string(u.ApprovalStatus)}
		if p, err := t.d.Profiles.GetByUserID(ctx, u.ID); err == nil {
			m.Course = p.Course
		}
		if apps, err := t.d.Applications.ListByStudent(ctx, u.ID); err != nil {
			return nil, err
		} else if len(apps) > 0 {
			a := apps[0] // newest first
			m.LatestApplication = &latestApp{Status: string(a.Status), Dormitory: t.dormitoryName(ctx, a.DormitoryID), SubmittedOn: dateOnly(a.CreatedAt)}
		}
		if rr, err := t.d.Rooms.GetActiveResidentByStudent(ctx, u.ID); err == nil {
			if m.CurrentRoom, err = t.roomRef(ctx, rr.RoomID); err != nil {
				return nil, err
			}
		} else if !errors.Is(err, repository.ErrNotFound) {
			return nil, err
		}
		out = append(out, m)
	}
	return out, nil
}

func (t *assistantTools) studentForApplication(ctx context.Context, applicationID uuid.UUID) (student, dormitory string) {
	app, err := t.d.Applications.GetByID(ctx, applicationID)
	if err != nil {
		return "", ""
	}
	if u, err := t.d.Users.GetByID(ctx, app.StudentID); err == nil {
		student = u.FullName
	}
	return student, t.dormitoryName(ctx, app.DormitoryID)
}

func (t *assistantTools) contractsNeedingAttention(ctx context.Context, _ *domain.User, _ json.RawMessage) (any, error) {
	type item struct {
		Student   string `json:"student"`
		Dormitory string `json:"dormitory"`
		Status    string `json:"status"`
		Deadline  string `json:"response_deadline"`
	}
	now := time.Now()
	overdue, soon := []item{}, []item{}
	for _, status := range []domain.ContractStatus{domain.ContractAwaitingManagerDecision, domain.ContractSent} {
		st := status
		list, err := t.d.Contracts.List(ctx, &st)
		if err != nil {
			return nil, err
		}
		for _, c := range list {
			student, dorm := t.studentForApplication(ctx, c.ApplicationID)
			it := item{Student: student, Dormitory: dorm, Status: string(c.Status), Deadline: c.ResponseDeadline.In(kyzylorda).Format("2006-01-02 15:04")}
			switch {
			case c.Status == domain.ContractAwaitingManagerDecision || c.ResponseDeadline.Before(now):
				overdue = append(overdue, it)
			case c.ResponseDeadline.Before(now.Add(72 * time.Hour)):
				soon = append(soon, it)
			}
		}
	}
	return map[string]any{"overdue": overdue, "deadline_within_3_days": soon}, nil
}

func (t *assistantTools) openRequests(ctx context.Context, _ *domain.User, _ json.RawMessage) (any, error) {
	type item struct {
		Kind        string   `json:"kind"`
		Student     string   `json:"student"`
		CurrentRoom *roomRef `json:"current_room"`
		Reason      *string  `json:"reason,omitempty"`
		CreatedOn   string   `json:"created_on"`
	}
	out := []item{}
	name := func(id uuid.UUID) string {
		if u, err := t.d.Users.GetByID(ctx, id); err == nil {
			return u.FullName
		}
		return ""
	}
	pendingExit := domain.ExitRequestPending
	exits, err := t.d.ExitRequests.List(ctx, &pendingExit)
	if err != nil {
		return nil, err
	}
	for _, e := range exits {
		it := item{Kind: "move_out", Student: name(e.StudentID), Reason: e.Reason, CreatedOn: dateOnly(e.RequestedAt)}
		if rr, err := t.d.Rooms.GetResidentByID(ctx, e.RoomResidentID); err == nil {
			it.CurrentRoom, _ = t.roomRef(ctx, rr.RoomID)
		}
		out = append(out, it)
	}
	pendingTransfer := domain.TransferRequestPending
	transfers, err := t.d.TransferRequests.List(ctx, &pendingTransfer)
	if err != nil {
		return nil, err
	}
	for _, tr := range transfers {
		it := item{Kind: "room_transfer", Student: name(tr.StudentID), Reason: tr.Reason, CreatedOn: dateOnly(tr.CreatedAt)}
		it.CurrentRoom, _ = t.roomRef(ctx, tr.CurrentRoomID)
		out = append(out, it)
	}
	return out, nil
}

// ---- committee tools ----

func (t *assistantTools) myProtocolVotes(ctx context.Context, user *domain.User, _ json.RawMessage) (any, error) {
	type item struct {
		ProtocolID   uuid.UUID `json:"protocol_id"`
		Number       int       `json:"number"`
		CreatedOn    string    `json:"created_on"`
		Applications int       `json:"applications"`
		MyVote       *string   `json:"my_vote"`
	}
	pending := domain.ProtocolPending
	list, err := t.d.Protocols.List(ctx, &pending)
	if err != nil {
		return nil, err
	}
	out := []item{}
	for _, p := range list {
		votes, err := t.d.Protocols.ListVotes(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		var vote *domain.CommitteeVote
		for _, v := range votes {
			if v.CommitteeMemberID == user.ID {
				vote = v
			}
		}
		if vote == nil {
			continue // not a member of this protocol's commission
		}
		ids, err := t.d.Protocols.ListApplicationIDs(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		it := item{ProtocolID: p.ID, Number: p.Number, CreatedOn: dateOnly(p.CreatedAt), Applications: len(ids)}
		if vote.Decision != nil {
			s := string(*vote.Decision)
			it.MyVote = &s
		}
		out = append(out, it)
	}
	return out, nil
}
