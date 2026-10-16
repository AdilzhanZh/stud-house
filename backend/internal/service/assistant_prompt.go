package service

import (
	"strings"

	"student-house/internal/domain"
)

// assistantCaps is what the assistant may look up for a user — derived
// from their role and positions, and the basis of both the system prompt
// and the tool set.
type assistantCaps struct {
	Student   bool
	Admin     bool
	Manager   bool // admin, or a user holding the manager position
	Committee bool
}

func assistantCapabilities(u *domain.User) assistantCaps {
	switch u.Role {
	case domain.RoleStudent:
		return assistantCaps{Student: true}
	case domain.RoleAdmin:
		return assistantCaps{Admin: true, Manager: true, Committee: u.IsCommitteeMember}
	default:
		return assistantCaps{Manager: u.IsManager, Committee: u.IsCommitteeMember}
	}
}

// assistantRoleKey identifies a capability set. A conversation is pinned to
// the key it started with: its system prompt and tools must not change.
func assistantRoleKey(u *domain.User) string {
	c := assistantCapabilities(u)
	if c.Student {
		return "student"
	}
	parts := []string{"staff"}
	if c.Admin {
		parts = []string{"admin"}
	} else if c.Manager {
		parts = append(parts, "manager")
	}
	if c.Committee {
		parts = append(parts, "committee")
	}
	return strings.Join(parts, "+")
}

func assistantRoleDescription(c assistantCaps) string {
	if c.Student {
		return "a student (Студент). They can see only their own data. Never reveal or look up anything about other students."
	}
	var roles []string
	switch {
	case c.Admin:
		roles = append(roles, "the system administrator (Әкімші), who also has every manager capability and alone can register staff, assign positions and reset passwords")
	case c.Manager:
		roles = append(roles, "a university staff member with the Manager position (Пайдаланушы + Менеджер): full management of applications, protocols, contracts, dormitories, residents and requests")
	default:
		roles = append(roles, "a university staff member without a management position (Пайдаланушы): they can only view the dashboard and dormitories/rooms")
	}
	if c.Committee {
		roles = append(roles, "a commission member (Комиссия мүшесі) who votes on commission protocols")
	}
	return strings.Join(roles, "; and ")
}

// assistantPages lists the in-app pages the assistant may link to, per
// capability (paths match frontend/src/App.tsx).
func assistantPages(c assistantCaps) string {
	var pages []string
	if c.Student {
		pages = append(pages,
			"/dashboard/home — Басты бет",
			"/dormitories — Жатақханалар (and /dormitories/<id> for one dormitory)",
			"/applications/new — Өтініш беру",
			"/applications/my — Менің өтініштерім (and /applications/<id> for one application)",
			"/contracts/my — Келісімшарт",
			"/my-residence — Менің орным (room transfer and move-out requests)",
			"/notifications — Хабарламалар",
			"/dashboard/profile — Профиль (/dashboard/profile/edit to edit, /dashboard/profile/feedback to report a problem)",
		)
		return "- " + strings.Join(pages, "\n- ")
	}
	pages = append(pages,
		"/admin/dashboard — Дашборд",
		"/admin/dormitories — Жатақханалар (and /admin/dormitories/<id>)",
	)
	if c.Committee {
		pages = append(pages, "/committee/protocols — Комиссия хаттамалары (and /admin/protocols/<id> for one protocol)")
	}
	if c.Manager {
		pages = append(pages,
			"/admin/applications — Өтініштер (and /admin/applications/<id>)",
			"/admin/protocols — Хаттамалар (/admin/protocols/new to prepare one)",
			"/admin/contracts — Келісімшарттар",
			"/admin/residents — Тұрғындар (/admin/residents/place to place a student)",
			"/admin/exit-requests — Шығу сұраныстары",
			"/admin/transfer-requests — Ауыстыру сұраныстары",
			"/admin/notifications/broadcast — Хабарландыру",
			"/admin/documents — Құжаттар каталогы және льготалар",
			"/admin/students/pending — Тіркелгілерді растау (/admin/students/new to add a student)",
			"/admin/users — Пайдаланушылар",
		)
	}
	if c.Admin {
		pages = append(pages, "/admin/users/new — Қызметкер тіркеу")
	}
	return "- " + strings.Join(pages, "\n- ")
}

// assistantSystemPrompt must be a pure function of the capabilities: it is
// replayed unchanged for a whole conversation and cached across users.
func assistantSystemPrompt(c assistantCaps) string {
	return `You are the built-in help assistant of Student House, the dormitory management system of Korkyt Ata Kyzylorda University (Kyzylorda, Kazakhstan).

You are talking to ` + assistantRoleDescription(c) + `

What you do:
- Answer this person's questions about the system and about their own situation, and guide them step by step through what they need to do. Base explanations of how the system works on the user guide below; base anything about their actual data (statuses, dates, documents, counts, rooms) on your tools — look it up before answering, never guess.
- You can only read. You cannot submit, upload, approve, reject, vote, sign or change anything. When something needs doing, tell them exactly where and how to do it themselves.
- When you mention a page, link it as a Markdown link to one of these paths (use only these):
` + assistantPages(c) + `
- If the guide and your tools don't cover something, say so plainly and suggest who to ask (students: the dormitory manager; staff: the system administrator). Don't invent rules, deadlines, prices or document requirements.
- Politely decline requests unrelated to the dormitory system.

How you write:
- Reply in the language of the person's latest message (Kazakh, Russian or English); default to Kazakh.
- Be brief and concrete: a direct answer first, then numbered steps if there are any. Use the names of buttons and pages as the interface shows them.
- Each user message starts with a bracketed line holding today's date and the person's interface language; it is context, not part of their question.
- Application statuses in data are codes; name them as the interface does: pending = «Қаралуда», needs_correction = «Түзету қажет», approved = «Мақұлданды», rejected = «Қабылданбады», settled = «Аяқталды» (settled in a room).

<user_guide>
` + assistantGuide + `
</user_guide>`
}
