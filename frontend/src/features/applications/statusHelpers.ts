import type { TFunction } from 'i18next'
import type { JourneyStep } from '../../components/ApplicationJourneyStepper'
import type { ApplicationStatus } from '../../types/applications'
import type { Contract } from '../../types/contracts'
import type { ProtocolStatus } from '../../types/protocols'

// Mirrors ApplicationRepository.GetActiveByStudent's SQL filter
// (status IN ('pending','manager_review','needs_correction')) — the backend
// only rejects a new POST /applications while one of these is open, so this
// is the same set the frontend uses to decide whether to show or hide the
// "Өтініш беру" action.
const ACTIVE_STATUSES: ApplicationStatus[] = ['pending', 'manager_review', 'needs_correction']

export function isActiveApplicationStatus(status: ApplicationStatus): boolean {
  return ACTIVE_STATUSES.includes(status)
}

// Maps an application's own status onto the signature journey stepper.
// Committee/contract/settlement state only become known from other
// endpoints this helper doesn't load, so 'accepted' (manager approved) is
// the furthest step derivable from status alone — good enough for the
// decorative purpose this serves. Rejected applications left the forward
// path entirely, so callers should skip rendering the stepper rather than
// showing it stuck partway.
export function applicationStatusToJourneyStep(status: ApplicationStatus): JourneyStep | null {
  switch (status) {
    case 'pending':
    case 'manager_review':
    case 'needs_correction':
      return 'under_review'
    case 'approved':
      return 'accepted'
    case 'settled':
      return 'settled'
    case 'rejected':
      return null
    default:
      return null
  }
}

// The accurate version of the step above: an 'approved' application could
// really be sitting at any of three further stages — manager-approved and
// not yet sent to committee, sent and awaiting a unanimous committee vote,
// or committee-approved and about to be placed — which Application.status
// alone can't tell apart (see ProtocolService.GetByApplicationID). A contract
// exists from submission and is already accepted, so it says nothing about
// these stages. Only an application older than the wizard's contract step can
// still be waiting on a contract response ('contract').
// Callers that already have the application's protocol and contract
// (Home, My Applications, both Application Detail pages) should use this
// instead so the progress bar reads the same everywhere. An application's
// status stays 'settled' forever even after the student later moves out
// (approving an exit request only touches room_residents, not applications),
// so hasActiveResidence lets callers fall back to the same "left the forward
// path" treatment as rejected once the student no longer actually lives there.
export function computeJourneyStep(
  status: ApplicationStatus,
  protocol: { status: ProtocolStatus } | null,
  contract: Contract | null,
  hasActiveResidence: boolean,
): JourneyStep | null {
  if (status === 'rejected') return null
  if (status === 'settled') return hasActiveResidence ? 'settled' : null
  if (status !== 'approved') return applicationStatusToJourneyStep(status)

  if (contract && contract.status !== 'accepted') return 'contract'
  if (!protocol) return 'accepted'
  return protocol.status === 'approved' ? 'fully_approved' : 'committee_review'
}

const STEP_ORDER: JourneyStep[] = [
  'submitted',
  'under_review',
  'accepted',
  'committee_review',
  'fully_approved',
  'settled',
]

// 'contract' is only reachable by an application older than the wizard's
// contract step, and shares its position with 'fully_approved'.
export function journeyStepIndex(step: JourneyStep): number {
  return STEP_ORDER.indexOf(step === 'contract' ? 'fully_approved' : step)
}

export function journeyStepCaption(step: JourneyStep, t: TFunction): string {
  const n = journeyStepIndex(step) + 1
  return `${n}/${STEP_ORDER.length} ${t(`journeyCaption.${step}`)}`
}
