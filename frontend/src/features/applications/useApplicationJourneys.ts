import { useEffect, useState } from 'react'
import { listMyContracts } from '../../api/contractApi'
import { listMyPayments } from '../../api/paymentApi'
import { computeJourneyStep } from './statusHelpers'
import type { JourneyStep } from '../../components/ApplicationJourneyStepper'
import type { Application } from '../../types/applications'
import type { Contract } from '../../types/contracts'
import type { Payment } from '../../types/payments'

export interface ApplicationJourneyState {
  contract: Contract | null
  payment: Payment | null
  step: JourneyStep | null
}

// One fetch of the student's contracts+payments, matched back to every
// application in the list — reused by Home (latest application only) and
// My Applications / Application Detail (every application) so the 6-segment
// progress bar is computed identically everywhere.
export function useApplicationJourneys(
  applications: Application[] | null,
): Record<string, ApplicationJourneyState> {
  const [byId, setById] = useState<Record<string, ApplicationJourneyState>>({})

  useEffect(() => {
    if (!applications || applications.length === 0) return
    let cancelled = false

    async function load() {
      const [contracts, payments] = await Promise.all([
        listMyContracts().catch(() => []),
        listMyPayments().catch(() => []),
      ])
      if (cancelled) return

      const next: Record<string, ApplicationJourneyState> = {}
      for (const app of applications ?? []) {
        const contract = contracts.find((c) => c.application_id === app.id) ?? null
        const payment = contract ? (payments.find((p) => p.contract_id === contract.id) ?? null) : null
        next[app.id] = { contract, payment, step: computeJourneyStep(app.status, contract, payment) }
      }
      setById(next)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [applications])

  return byId
}
