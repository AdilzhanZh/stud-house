package service

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/google/uuid"

	"student-house/internal/domain"
	"student-house/internal/repository"
	"student-house/internal/service/notifier"
	"student-house/pkg/apperror"
)

type ProtocolService struct {
	protocols    repository.ProtocolRepository
	applications repository.ApplicationRepository
	users        repository.UserRepository
	dormitories  repository.DormitoryRepository
	rooms        repository.RoomRepository
	notifier     *notifier.Notifier
	// onApproved is an optional hook (contract auto-generation), wired via
	// SetOnApproved. Vote() calls it right after a protocol becomes
	// approved; nil means no-op.
	onApproved func(ctx context.Context, protocolID uuid.UUID) error
}

// SetOnApproved registers a callback invoked once a protocol's vote tally
// resolves to ProtocolApproved. Errors are logged, not returned to the
// caller of Vote — the vote itself has already committed successfully.
func (s *ProtocolService) SetOnApproved(fn func(ctx context.Context, protocolID uuid.UUID) error) {
	s.onApproved = fn
}

func NewProtocolService(
	protocols repository.ProtocolRepository,
	applications repository.ApplicationRepository,
	users repository.UserRepository,
	dormitories repository.DormitoryRepository,
	rooms repository.RoomRepository,
	notifier *notifier.Notifier,
) *ProtocolService {
	return &ProtocolService{
		protocols:    protocols,
		applications: applications,
		users:        users,
		dormitories:  dormitories,
		rooms:        rooms,
		notifier:     notifier,
	}
}

func (s *ProtocolService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Protocol, error) {
	protocol, err := s.protocols.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, apperror.NotFound("хаттама табылмады")
		}
		return nil, err
	}
	return protocol, nil
}

func (s *ProtocolService) List(ctx context.Context, status *domain.ProtocolStatus) ([]*domain.Protocol, error) {
	return s.protocols.List(ctx, status)
}

// EligibleApplications is the manager's "prepare protocol" candidate list:
// approved applications not yet attached to any protocol.
func (s *ProtocolService) EligibleApplications(ctx context.Context) ([]*domain.Application, error) {
	ids, err := s.protocols.EligibleApplicationIDs(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Application, 0, len(ids))
	for _, id := range ids {
		app, err := s.applications.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				continue
			}
			return nil, err
		}
		out = append(out, app)
	}
	return out, nil
}

// Delete is only allowed while a protocol is still pending — once approved
// it's a finalized committee decision (contracts may already have been
// generated off it) and shouldn't be removable. A stuck pending protocol
// (e.g. a member rejected it) can be deleted to free its students up for a
// new one — there is no "revise in place" flow.
func (s *ProtocolService) Delete(ctx context.Context, id uuid.UUID) error {
	protocol, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if protocol.Status != domain.ProtocolPending {
		return apperror.Conflict("толық мақұлданған хаттаманы өшіру мүмкін емес")
	}
	if err := s.protocols.Delete(ctx, id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return apperror.NotFound("хаттама табылмады")
		}
		return err
	}
	return nil
}

// activeCommitteeMemberIDs fetches the current committee roster
// (is_committee_member = true); a protocol cannot be prepared if there is no
// one to review it.
func (s *ProtocolService) activeCommitteeMemberIDs(ctx context.Context) ([]uuid.UUID, error) {
	members, err := s.users.ListCommitteeMembers(ctx)
	if err != nil {
		return nil, err
	}
	if len(members) == 0 {
		return nil, apperror.BadRequest("бұл хаттаманы қарайтын комиссия мүшесі жоқ")
	}
	ids := make([]uuid.UUID, len(members))
	for i, m := range members {
		ids[i] = m.ID
	}
	return ids, nil
}

func mapProtocolCreationError(err error) error {
	switch {
	case errors.Is(err, repository.ErrNotFound):
		return apperror.BadRequest("бір немесе бірнеше өтініш табылмады")
	case errors.Is(err, repository.ErrApplicationNotApproved):
		return apperror.BadRequest("барлық өтініштер \"мақұлданды\" мәртебесінде болуы керек")
	case errors.Is(err, repository.ErrConflict):
		return apperror.Conflict("бір немесе бірнеше өтініш қазірдің өзінде басқа хаттамада бар")
	default:
		return err
	}
}

// Create bundles applicationIDs (all must be status=approved and not
// already attached to any protocol) into a new protocol and sends it to
// every current committee member for review — approval requires every
// member's vote (see Vote), it is not automatic.
func (s *ProtocolService) Create(ctx context.Context, actorID uuid.UUID, applicationIDs []uuid.UUID) (*domain.Protocol, error) {
	if len(applicationIDs) == 0 {
		return nil, apperror.BadRequest("өтініштер тізімі міндетті")
	}

	committeeMemberIDs, err := s.activeCommitteeMemberIDs(ctx)
	if err != nil {
		return nil, err
	}

	protocol := &domain.Protocol{CreatedBy: actorID, Status: domain.ProtocolPending}
	if err := s.protocols.CreateWithApplications(ctx, protocol, applicationIDs, committeeMemberIDs); err != nil {
		return nil, mapProtocolCreationError(err)
	}

	s.notifyCommitteeNewProtocol(ctx, protocol, committeeMemberIDs)
	return protocol, nil
}

func allVotesCast(votes []*domain.CommitteeVote) bool {
	for _, v := range votes {
		if v.Decision == nil {
			return false
		}
	}
	return true
}

func allVotesApproved(votes []*domain.CommitteeVote) bool {
	for _, v := range votes {
		if v.Decision == nil || *v.Decision != domain.VoteApproved {
			return false
		}
	}
	return true
}

// Vote records one committee member's decision. A protocol becomes
// ProtocolApproved only once every member has voted 'approved' (unanimous);
// any other outcome — a rejection, or votes still outstanding — simply
// leaves it ProtocolPending (see domain.ProtocolStatus). Evaluated under a
// row lock so concurrent votes on the same protocol serialize.
func (s *ProtocolService) Vote(ctx context.Context, actorID, protocolID uuid.UUID, decision domain.VoteDecision, reason *string) (*domain.Protocol, error) {
	if !decision.Valid() {
		return nil, apperror.BadRequest("шешім жарамсыз")
	}
	if decision == domain.VoteRejected && (reason == nil || *reason == "") {
		return nil, apperror.BadRequest("қабылдамау үшін себебі міндетті")
	}

	var becameApproved bool
	var creatorID uuid.UUID

	err := s.protocols.WithVoteLock(ctx, protocolID, func(ctx context.Context, protocol *domain.Protocol, tx repository.ProtocolTx) error {
		if protocol.Status != domain.ProtocolPending {
			return apperror.Conflict("хаттама енді комиссия қарауында емес")
		}
		creatorID = protocol.CreatedBy
		if _, err := tx.GetVote(ctx, protocolID, actorID); err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				return apperror.Forbidden("сіз бұл хаттаманың комиссия мүшесі емессіз")
			}
			return err
		}
		if err := tx.SetVote(ctx, protocolID, actorID, decision, reason); err != nil {
			return err
		}

		votes, err := tx.ListVotes(ctx, protocolID)
		if err != nil {
			return err
		}
		if allVotesCast(votes) && allVotesApproved(votes) {
			becameApproved = true
			return tx.SetProtocolStatus(ctx, protocolID, domain.ProtocolApproved)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	updated, err := s.GetByID(ctx, protocolID)
	if err != nil {
		return nil, err
	}

	if decision == domain.VoteRejected {
		s.notifyProtocolRejection(ctx, creatorID, updated, actorID, reason)
	}
	if becameApproved {
		s.notifyProtocolApproved(ctx, creatorID, updated)
		s.runOnApproved(ctx, updated.ID)
	}
	return updated, nil
}

func (s *ProtocolService) notifyCommitteeNewProtocol(ctx context.Context, protocol *domain.Protocol, committeeMemberIDs []uuid.UUID) {
	body := fmt.Sprintf("№%d хаттама сіздің қарауыңызды күтуде.", protocol.Number)
	for _, memberID := range committeeMemberIDs {
		_ = s.notifier.Notify(ctx, memberID, domain.NotificationProtocolReview, "Жаңа хаттама қарауға жіберілді", body, nil)
	}
}

func (s *ProtocolService) notifyProtocolApproved(ctx context.Context, creatorID uuid.UUID, protocol *domain.Protocol) {
	body := fmt.Sprintf("№%d хаттама комиссия тарапынан толық мақұлданды.", protocol.Number)
	_ = s.notifier.Notify(ctx, creatorID, domain.NotificationProtocolReview, "Хаттама мақұлданды", body, nil)
}

func (s *ProtocolService) notifyProtocolRejection(ctx context.Context, creatorID uuid.UUID, protocol *domain.Protocol, memberID uuid.UUID, reason *string) {
	member, err := s.users.GetByID(ctx, memberID)
	memberName := "Комиссия мүшесі"
	if err == nil && member != nil {
		memberName = member.FullName
	}
	body := fmt.Sprintf("№%d хаттаманы %s қабылдамады.", protocol.Number, memberName)
	if reason != nil && *reason != "" {
		body += " Себебі: " + *reason
	}
	_ = s.notifier.Notify(ctx, creatorID, domain.NotificationProtocolReview, "Хаттамаға қарсы дауыс берілді", body, nil)
}

// runOnApproved invokes the post-approval hook (contract auto-generation).
func (s *ProtocolService) runOnApproved(ctx context.Context, protocolID uuid.UUID) {
	if s.onApproved == nil {
		return
	}
	if err := s.onApproved(ctx, protocolID); err != nil {
		log.Printf("protocol %s approved but onApproved hook failed: %v", protocolID, err)
	}
}

// ProtocolDetail bundles a protocol with everything needed to render it:
// each application + its student, and the committee vote roster.
type ProtocolDetail struct {
	Protocol         *domain.Protocol
	Applications     []*domain.Application
	Students         map[uuid.UUID]*domain.User
	Dormitories      map[uuid.UUID]*domain.Dormitory
	Rooms            map[uuid.UUID]*domain.Room
	Votes            []*domain.CommitteeVote
	CommitteeMembers map[uuid.UUID]*domain.User
}

func (s *ProtocolService) GetDetail(ctx context.Context, protocolID uuid.UUID) (*ProtocolDetail, error) {
	protocol, err := s.GetByID(ctx, protocolID)
	if err != nil {
		return nil, err
	}

	appIDs, err := s.protocols.ListApplicationIDs(ctx, protocolID)
	if err != nil {
		return nil, err
	}

	applications := make([]*domain.Application, 0, len(appIDs))
	students := make(map[uuid.UUID]*domain.User)
	dormitories := make(map[uuid.UUID]*domain.Dormitory)
	rooms := make(map[uuid.UUID]*domain.Room)
	for _, id := range appIDs {
		app, err := s.applications.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, repository.ErrNotFound) {
				continue
			}
			return nil, err
		}
		applications = append(applications, app)
		if _, ok := students[app.StudentID]; !ok {
			student, err := s.users.GetByID(ctx, app.StudentID)
			if err != nil {
				return nil, err
			}
			students[app.StudentID] = student
		}
		if _, ok := dormitories[app.DormitoryID]; !ok {
			dormitory, err := s.dormitories.GetByID(ctx, app.DormitoryID)
			if err != nil {
				return nil, err
			}
			dormitories[app.DormitoryID] = dormitory
		}
		if app.AssignedRoomID != nil {
			if _, ok := rooms[*app.AssignedRoomID]; !ok {
				room, err := s.rooms.GetByID(ctx, *app.AssignedRoomID)
				if err != nil {
					return nil, err
				}
				rooms[*app.AssignedRoomID] = room
			}
		}
	}

	votes, err := s.protocols.ListVotes(ctx, protocolID)
	if err != nil {
		return nil, err
	}
	committeeMembers := make(map[uuid.UUID]*domain.User)
	for _, v := range votes {
		if _, ok := committeeMembers[v.CommitteeMemberID]; !ok {
			member, err := s.users.GetByID(ctx, v.CommitteeMemberID)
			if err != nil {
				return nil, err
			}
			committeeMembers[v.CommitteeMemberID] = member
		}
	}

	return &ProtocolDetail{
		Protocol:         protocol,
		Applications:     applications,
		Students:         students,
		Dormitories:      dormitories,
		Rooms:            rooms,
		Votes:            votes,
		CommitteeMembers: committeeMembers,
	}, nil
}
