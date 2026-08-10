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

// defaultPetitionTemplateHTML mirrors the approved paper "Өтініш" sample
// (petition to the rector for a dormitory place), with the blanks that vary
// per student replaced by the matching domain.PetitionVariables token.
var defaultPetitionTemplatePages = []string{defaultPetitionTemplateHTML}

const defaultPetitionTemplateHTML = `<div style="text-align:right;margin-bottom:24px;">` +
	`<p style="margin:0;">Қорқыт ата атындағы</p>` +
	`<p style="margin:0;">Қызылорда университетінің</p>` +
	`<p style="margin:0;">Басқарма төрағасы – Ректор</p>` +
	`<p style="margin:0;">Н.С.Байкадамовқа</p>` +
	`<p style="margin:0;"><span class="petition-var" data-token="{{study_group}}" contenteditable="false">Оқу тобы</span>&nbsp;оқу тобының студенті</p>` +
	`<p style="margin:0;"><span class="petition-var" data-token="{{full_name}}" contenteditable="false">Аты-жөні</span></p>` +
	`</div>` +
	`<h2 style="text-align:center;font-weight:700;margin:0 0 24px;">Өтініш</h2>` +
	`<p style="text-align:justify;margin:0 0 16px;">Осы өтінішім арқылы Сізден университетке қарасты жатақханадан 1 (бір) орын беруіңізді сұраймын.</p>` +
	`<p style="margin:0 0 12px;">Келген жерім:&nbsp;<span class="petition-var" data-token="{{hometown}}" contenteditable="false">Келген жері</span>&nbsp;(ауыл, аудан)</p>` +
	`<p style="margin:0 0 4px;">Байланыс нөмірі:&nbsp;<span class="petition-var" data-token="{{phone_self}}" contenteditable="false">Өз телефоны</span>&nbsp;(Өзім)</p>` +
	`<p style="margin:0 0 24px 140px;"><span class="petition-var" data-token="{{parent_contact}}" contenteditable="false">Ата-ана телефоны</span>&nbsp;(Ата-ана, аға, тәте)</p>` +
	`<p style="margin:48px 0 0;">Өтініш иесінің қолы: __________________</p>` +
	`<p style="margin:8px 0 0;">Күні:&nbsp;<span class="petition-var" data-token="{{date}}" contenteditable="false">Күні</span></p>`

type PetitionTemplateService struct {
	templates repository.PetitionTemplateRepository
}

func NewPetitionTemplateService(templates repository.PetitionTemplateRepository) *PetitionTemplateService {
	return &PetitionTemplateService{templates: templates}
}

// Get never 404s: before any manager has customized the wording, it returns
// the pre-seeded default content (not persisted until Update is first
// called) — mirrors UserService.GetStudentProfile's same trade-off.
func (s *PetitionTemplateService) Get(ctx context.Context) (*domain.PetitionTemplate, error) {
	t, err := s.templates.Get(ctx)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return &domain.PetitionTemplate{Pages: defaultPetitionTemplatePages}, nil
		}
		return nil, err
	}
	return t, nil
}

// Update is manager/admin-only (enforced by the route group). It always
// overwrites the single system-wide template — there's no per-template
// selection or history, per the current spec.
func (s *PetitionTemplateService) Update(ctx context.Context, actorID uuid.UUID, pages []string) (*domain.PetitionTemplate, error) {
	if len(pages) == 0 {
		return nil, apperror.BadRequest("үлгіде кемінде бір бет болуы керек")
	}
	for _, p := range pages {
		if strings.TrimSpace(p) == "" {
			return nil, apperror.BadRequest("үлгінің беттері бос болмауы керек")
		}
	}
	t := &domain.PetitionTemplate{Pages: pages, UpdatedBy: actorID}
	if err := s.templates.Upsert(ctx, t); err != nil {
		return nil, err
	}
	return t, nil
}
