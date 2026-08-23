package service

import (
	"context"
	"time"

	"student-house/internal/repository"
)

// RetentionResult reports how many rows PurgeExpired deleted from each
// table on one sweep.
type RetentionResult struct {
	ProtocolsDeleted    int64
	ContractsDeleted    int64
	ApplicationsDeleted int64
}

// RetentionService permanently deletes applications, contracts, and
// protocols once they're older than Period. Applications, contracts, and
// protocols all carry their own created_at, so each is purged on its own
// age — a contract isn't kept alive just because its application is recent,
// or vice versa.
type RetentionService struct {
	protocols    repository.ProtocolRepository
	contracts    repository.ContractRepository
	applications repository.ApplicationRepository
	period       time.Duration
}

func NewRetentionService(
	protocols repository.ProtocolRepository,
	contracts repository.ContractRepository,
	applications repository.ApplicationRepository,
	period time.Duration,
) *RetentionService {
	return &RetentionService{protocols: protocols, contracts: contracts, applications: applications, period: period}
}

// PurgeExpired deletes everything created before now-Period. Order matters:
// protocols first (its own cascades clear protocol_applications /
// committee_votes), then contracts, then applications — both
// contracts.application_id and protocol_applications.application_id lack an
// ON DELETE CASCADE, so an application is only actually removed once
// nothing still references it (ApplicationRepository.DeleteOlderThan skips
// the rest and picks them up on a later sweep).
func (s *RetentionService) PurgeExpired(ctx context.Context) (RetentionResult, error) {
	cutoff := time.Now().Add(-s.period)
	var result RetentionResult

	protocolsDeleted, err := s.protocols.DeleteOlderThan(ctx, cutoff)
	if err != nil {
		return result, err
	}
	result.ProtocolsDeleted = protocolsDeleted

	contractsDeleted, err := s.contracts.DeleteOlderThan(ctx, cutoff)
	if err != nil {
		return result, err
	}
	result.ContractsDeleted = contractsDeleted

	applicationsDeleted, err := s.applications.DeleteOlderThan(ctx, cutoff)
	if err != nil {
		return result, err
	}
	result.ApplicationsDeleted = applicationsDeleted

	return result, nil
}
