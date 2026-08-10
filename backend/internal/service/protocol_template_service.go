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

// defaultProtocolTemplateHTML mirrors the approved paper "Хаттама" sample
// (a dormitory-placement committee meeting's minutes), with the parts that
// vary per protocol replaced by the matching domain.ProtocolVariables token.
// The committee roster, agenda, and resolution wording are static text —
// same as the petition template, a manager edits them directly in the
// WYSIWYG editor when membership or wording changes.
var defaultProtocolTemplatePages = []string{defaultProtocolTemplateHTML}

const defaultProtocolTemplateHTML = `<h2 style="text-align:center;font-weight:700;margin:0 0 20px;">` +
	`Қорқыт ата атындағы Қызылорда университетінің студенттерін жатақханаға орналастыру жөніндегі комиссия отырысының хаттамасы №` +
	`<span class="protocol-var" data-token="{{protocol_number}}" contenteditable="false">Хаттама нөмірі</span></h2>` +
	`<p style="margin:0 0 16px;">Өткізілген күні:&nbsp;<span class="protocol-var" data-token="{{protocol_date}}" contenteditable="false">Хаттама күні</span></p>` +
	`<p style="margin:0 0 4px;font-weight:700;">Комиссия құрамы:</p>` +
	`<p style="margin:0 0 4px;">Төраға: Басқарма мүшесі – Әлеуметтік және тәрбие жұмыстары жөніндегі проректор У.С.Ибраев.</p>` +
	`<p style="margin:0 0 4px;">Мүшелері:</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Әлеуметтік және тәрбие жұмыстары басқармасының басшысы Ж.Е.Сагынбаева;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Гуманитарлық-педагогикалық институтының директоры С.Т. Тайман;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Педагогика және дәстүрлі өнер институтының директоры Н.Б. Мирманов;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Жаратылыстану институтының директоры Г.Б. Тоқтағанова;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Инженерлік-технологиялық институтының директоры Б.Б. Абжалелов;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Экономика және құқық институтының директоры А.Ж. Исаева;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Жасанды интеллект институтының директоры Н.С. Кулмырзаев;</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Әлеуметтік және тәрбие жұмыстары басқармасының әдіскері А.Қ.Маулен;</p>` +
	`<p style="margin:0 0 16px;padding-left:20px;">• Студенттік Омбудсмен – Ғ.М. Қуанышбеков.</p>` +
	`<p style="margin:0 0 4px;font-weight:700;">Күн тәртібі:</p>` +
	`<p style="text-align:justify;margin:0 0 16px;">2026–2027 оқу жылына білім алушыларды студенттік жатақханаға орналастыру туралы өтініштерді қарау.</p>` +
	`<p style="margin:0 0 4px;font-weight:700;">Тыңдалды:</p>` +
	`<p style="text-align:justify;margin:0 0 16px;">Комиссия төрағасы білім алушылардың жатақханадан орын беру туралы өтініштері мен ұсынылған құжаттары қаралғанын хабарлады. ` +
	`Комиссия Қазақстан Республикасының қолданыстағы нормативтік талаптарын және оқу орнының ішкі ережелерін басшылыққа ала отырып, ` +
	`үміткерлердің әлеуметтік жағдайын, тұрғылықты жерін, оқу нысанын және өзге де негіздерді ескеріп, өтініштерді талқылады.</p>` +
	`<p style="margin:0 0 4px;font-weight:700;">Қаулы етілді:</p>` +
	`<p style="margin:0 0 8px;padding-left:20px;">• Төмендегі білім алушыларға студенттік жатақханадан орын берілсін:</p>` +
	`<div style="padding-left:20px;margin:0 0 12px;">` +
	`<span class="protocol-var" data-token="{{student_list}}" contenteditable="false">Студенттер тізімі</span>` +
	`</div>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Жатақхана меңгерушісіне студенттерді белгіленген тәртіпке сәйкес бөлмелерге орналастыру тапсырылсын.</p>` +
	`<p style="margin:0 0 2px;padding-left:20px;">• Студенттер жатақхананың ішкі тәртіп ережелерімен таныстырылып, оларды сақтау міндеттелсін.</p>` +
	`<p style="margin:0 0 24px;padding-left:20px;">• Осы хаттаманың орындалуын бақылау комиссия төрағасына жүктелсін.</p>` +
	`<p style="margin:0 0 4px;">Комиссия төрағасы: __________________ /_______________/</p>` +
	`<p style="margin:12px 0 4px;">Комиссия мүшелері:</p>` +
	`<p style="margin:0 0 4px;">__________________ /_______________/</p>` +
	`<p style="margin:0 0 4px;">__________________ /_______________/</p>` +
	`<p style="margin:0 0 12px;">__________________ /_______________/</p>` +
	`<p style="margin:0;">Хатшы: __________________ /_______________/</p>`

type ProtocolTemplateService struct {
	templates repository.ProtocolTemplateRepository
}

func NewProtocolTemplateService(templates repository.ProtocolTemplateRepository) *ProtocolTemplateService {
	return &ProtocolTemplateService{templates: templates}
}

// Get never 404s: before any manager has customized the wording, it returns
// the pre-seeded default content (not persisted until Update is first
// called) — mirrors PetitionTemplateService.Get.
func (s *ProtocolTemplateService) Get(ctx context.Context) (*domain.ProtocolTemplate, error) {
	t, err := s.templates.Get(ctx)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return &domain.ProtocolTemplate{Pages: defaultProtocolTemplatePages}, nil
		}
		return nil, err
	}
	return t, nil
}

// Update is manager/admin-only (enforced by the route group). It always
// overwrites the single system-wide template.
func (s *ProtocolTemplateService) Update(ctx context.Context, actorID uuid.UUID, pages []string) (*domain.ProtocolTemplate, error) {
	if len(pages) == 0 {
		return nil, apperror.BadRequest("үлгіде кемінде бір бет болуы керек")
	}
	for _, p := range pages {
		if strings.TrimSpace(p) == "" {
			return nil, apperror.BadRequest("үлгінің беттері бос болмауы керек")
		}
	}
	t := &domain.ProtocolTemplate{Pages: pages, UpdatedBy: actorID}
	if err := s.templates.Upsert(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}
