package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

const errReferralTemplateMissingVariable = "жолдама үлгісінде жолдама нөмірі, студенттің аты-жөні, жатақхана және бөлме нөмірі болуы керек"

func referralVariableChip(token, label string) string {
	return `<span class="referral-var" data-token="{{` + token + `}}" contenteditable="false">` + label + `</span>`
}

func referralFieldRow(label, token, tokenLabel string) string {
	return `<tr>` +
		`<td style="width:150px;height:44px;padding:0 12px 8px 0;vertical-align:bottom;color:#5a6b86;white-space:nowrap;">` + label + `</td>` +
		`<td style="height:44px;padding:0 0 8px;vertical-align:bottom;border-bottom:1px solid #9aa8bf;font-size:16px;font-weight:700;">` + referralVariableChip(token, tokenLabel) + `</td>` +
		`</tr>`
}

// defaultReferralTemplatePages mirrors the university's paper form.
var defaultReferralTemplatePages = []string{
	`<div style="text-align:center;margin:0 0 36px;">` +
		`<p style="margin:0;font-size:17px;font-weight:700;">Білім алушыларға жатақхана берілетіні туралы</p>` +
		`<p style="margin:6px 0 0;font-size:26px;font-weight:700;letter-spacing:2px;">ЖОЛДАМА № ` + referralVariableChip("referral_number", "Жолдама нөмірі") + `</p>` +
		`</div>` +
		`<table style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 44px;"><tbody>` +
		referralFieldRow("Азамат(-ша)", "student_full_name", "Студенттің аты-жөні") +
		referralFieldRow("Жатақхана", "dormitory_name", "Жатақхана") +
		referralFieldRow("Бөлме №", "room_number", "Бөлме нөмірі") +
		referralFieldRow("Институты", "institute", "Институт") +
		referralFieldRow("Оқу тобы", "study_group", "Оқу тобы") +
		referralFieldRow("Мекен-жайы", "dormitory_address", "Жатақхана мекен-жайы") +
		`<tr>` +
		`<td style="width:150px;height:44px;padding:0 12px 8px 0;vertical-align:bottom;color:#5a6b86;white-space:nowrap;">Негіздеме</td>` +
		`<td style="height:44px;padding:0 0 8px;vertical-align:bottom;border-bottom:1px solid #9aa8bf;font-size:16px;font-weight:700;">Комиссия хаттамасы № ` + referralVariableChip("protocol_number", "Хаттама нөмірі") + `</td>` +
		`</tr>` +
		`</tbody></table>` +
		`<p style="margin:0;font-size:15px;">Әлеуметтік және тәрбие жұмыстары жөніндегі проректор</p>` +
		`<p style="margin:26px 0 0;font-size:15px;">____________________&nbsp;&nbsp;<b>` + referralVariableChip("signatory_name", "Проректордың аты-жөні") + `</b></p>` +
		`<p style="margin:18px 0 0;font-size:15px;color:#5a6b86;">Берілген күні: ` + referralVariableChip("issue_date", "Берілген күні") + `</p>`,
}

type ReferralTemplateService struct {
	templates repository.ReferralTemplateRepository
}

func NewReferralTemplateService(templates repository.ReferralTemplateRepository) *ReferralTemplateService {
	return &ReferralTemplateService{templates: templates}
}

// Get never 404s: until someone saves their own wording, it's the default.
func (s *ReferralTemplateService) Get(ctx context.Context) (*domain.ReferralTemplate, error) {
	t, err := s.templates.Get(ctx)
	if errors.Is(err, repository.ErrNotFound) {
		return &domain.ReferralTemplate{Pages: defaultReferralTemplatePages}, nil
	}
	return t, err
}

// validateReferralTemplatePages rejects a template that would produce referrals
// not saying whose they are or where the student is going.
func validateReferralTemplatePages(pages []string) error {
	if len(pages) == 0 {
		return apperror.BadRequest("үлгіде кемінде бір бет болуы керек")
	}
	for _, p := range pages {
		if strings.TrimSpace(p) == "" {
			return apperror.BadRequest("үлгінің беттері бос болмауы керек")
		}
	}
	all := strings.Join(pages, "")
	for _, v := range domain.ReferralVariables {
		if v.Required && !strings.Contains(all, `data-token="`+v.Token+`"`) {
			return apperror.BadRequest(errReferralTemplateMissingVariable)
		}
	}
	return nil
}

// Update is manager/admin-only (enforced by the route group).
func (s *ReferralTemplateService) Update(ctx context.Context, actorID uuid.UUID, pages []string) (*domain.ReferralTemplate, error) {
	if err := validateReferralTemplatePages(pages); err != nil {
		return nil, err
	}
	t := &domain.ReferralTemplate{Pages: pages, UpdatedBy: actorID}
	if err := s.templates.Upsert(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}
