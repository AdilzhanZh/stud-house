import type { JourneyStep } from '../../components/ApplicationJourneyStepper'
import type { ApplicationStatus } from '../../types/applications'

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
    case 'rejected':
      return null
    default:
      return null
  }
}
