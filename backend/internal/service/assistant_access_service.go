package service

import (
	"context"
	"errors"
	"slices"
	"sync"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/pkg/apperror"
)

// AssistantAccessService holds the API key (from the environment) and who
// may use the assistant — the one AI setting admins control. Access is read
// on every assistant request, so it's cached and replaced on save: a change
// applies immediately.
type AssistantAccessService struct {
	repo   repository.AssistantAccessRepository
	apiKey string

	mu      sync.RWMutex
	current domain.AssistantAccess
}

// NewAssistantAccessService: until an admin saves, every audience may use
// the assistant.
func NewAssistantAccessService(repo repository.AssistantAccessRepository, apiKey string) *AssistantAccessService {
	return &AssistantAccessService{
		repo:    repo,
		apiKey:  apiKey,
		current: domain.AssistantAccess{Audiences: slices.Clone(domain.AssistantAudiences)},
	}
}

// Load reads saved access into the cache; call once at startup.
func (s *AssistantAccessService) Load(ctx context.Context) error {
	saved, err := s.repo.Get(ctx)
	if errors.Is(err, repository.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.current = *saved
	s.mu.Unlock()
	return nil
}

// APIKey is the provider key; "" disables every AI feature.
func (s *AssistantAccessService) APIKey() string {
	if s == nil {
		return ""
	}
	return s.apiKey
}

func (s *AssistantAccessService) APIKeyPresent() bool { return s.APIKey() != "" }

func (s *AssistantAccessService) Current() domain.AssistantAccess {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.current
	out.Audiences = slices.Clone(out.Audiences)
	return out
}

// assistantAudiences are the groups a user belongs to.
func assistantAudiences(u *domain.User) []domain.AssistantAudience {
	switch u.Role {
	case domain.RoleStudent:
		return []domain.AssistantAudience{domain.AudienceStudent}
	case domain.RoleAdmin:
		return []domain.AssistantAudience{domain.AudienceAdmin}
	}
	out := []domain.AssistantAudience{domain.AudienceStaff}
	if u.IsManager {
		out = append(out, domain.AudienceManager)
	}
	if u.IsCommitteeMember {
		out = append(out, domain.AudienceCommittee)
	}
	return out
}

// Allowed reports whether this user may use the assistant right now: a key
// is configured and one of their groups is open.
func (s *AssistantAccessService) Allowed(u *domain.User) bool {
	if s == nil || u == nil || !s.APIKeyPresent() {
		return false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, a := range assistantAudiences(u) {
		if slices.Contains(s.current.Audiences, a) {
			return true
		}
	}
	return false
}

// Update replaces who may use the assistant. An empty list switches it off
// for everyone.
func (s *AssistantAccessService) Update(ctx context.Context, actorID uuid.UUID, audiences []domain.AssistantAudience) (domain.AssistantAccess, error) {
	clean := []domain.AssistantAudience{}
	for _, a := range domain.AssistantAudiences {
		if slices.Contains(audiences, a) {
			clean = append(clean, a)
		}
	}
	for _, a := range audiences {
		if !slices.Contains(domain.AssistantAudiences, a) {
			return domain.AssistantAccess{}, apperror.BadRequest("белгісіз рөл")
		}
	}
	saved := domain.AssistantAccess{Audiences: clean, UpdatedBy: &actorID}
	if err := s.repo.Save(ctx, &saved); err != nil {
		return domain.AssistantAccess{}, err
	}
	s.mu.Lock()
	s.current = saved
	s.mu.Unlock()
	return s.Current(), nil
}
