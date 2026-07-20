import type { TFunction } from 'i18next'
import type { JourneyStep } from '../../components/ApplicationJourneyStepper'
import type { ApplicationStatus } from '../../types/applications'
import type { Contract } from '../../types/contracts'

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
// Contract/payment/settlement only become known from other endpoints this
// page doesn't load, so 'approved' is the furthest step derivable here —
// good enough for the decorative purpose this serves. Rejected applications
// left the forward path entirely, so callers should skip rendering the
// stepper rather than showing it stuck partway.
export function applicationStatusToJourneyStep(status: ApplicationStatus): JourneyStep | null {
  switch (status) {
    case 'pending':
    case 'manager_review':
    case 'needs_correction':
      return 'under_review'
    case 'approved':
      return 'approved'
    case 'settled':
      return 'settled'
    case 'rejected':
      return null
    default:
      return null
  }
}

// The accurate version of the step above: contract lives on a separate
// endpoint, so an 'approved' application could really be sitting at
// contract-review depending on what's been created for it since. Callers
// that already have the student's contract list (Home, Application Detail)
// should use this instead so the 5-segment progress bar reads the same
// everywhere, per the design spec's single-source-of-truth note for
// application status. Accepting a contract settles the application
// immediately (no separate payment-confirmation step), so 'settled' is
// reached as soon as the contract is accepted — but an application's status
// stays 'settled' forever even after the student later moves out (approving
// an exit request only touches room_residents, not applications), so
// hasActiveResidence lets callers fall back to the same "left the forward
// path" treatment as rejected once the student no longer actually lives
// there.
export function computeJourneyStep(
  status: ApplicationStatus,
  contract: Contract | null,
  hasActiveResidence: boolean,
): JourneyStep | null {
  if (status === 'rejected') return null
  if (status === 'settled') return hasActiveResidence ? 'settled' : null
  if (status !== 'approved') return applicationStatusToJourneyStep(status)

  if (!contract) return 'approved'
  if (contract.status !== 'accepted') return 'contract'
  return hasActiveResidence ? 'settled' : null
}

const STEP_ORDER: JourneyStep[] = ['submitted', 'under_review', 'approved', 'contract', 'settled']

export function journeyStepIndex(step: JourneyStep): number {
  return STEP_ORDER.indexOf(step)
}

export function journeyStepCaption(step: JourneyStep, t: TFunction): string {
  const n = journeyStepIndex(step) + 1
  return `${n}/${STEP_ORDER.length} ${t(`journeyCaption.${step}`)}`
}
