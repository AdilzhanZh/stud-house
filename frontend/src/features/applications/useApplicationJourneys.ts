import { useEffect, useRef, useState } from 'react'
import { listMyContracts } from '../../api/contractApi'
import { getMyResidence } from '../../api/residenceApi'
import { getApplicationProtocol } from '../../api/protocolApi'
import { useAuth } from '../auth/useAuth'
import { computeJourneyStep } from './statusHelpers'
import type { JourneyStep } from '../../components/ApplicationJourneyStepper'
import type { Application } from '../../types/applications'
import type { Contract } from '../../types/contracts'
import type { Protocol } from '../../types/protocols'

export interface ApplicationJourneyState {
  contract: Contract | null
  step: JourneyStep | null
}

// One fetch of the student's contracts (+ current residence, to tell a
// still-'settled' application from one the student has since moved out of),
// matched back to every application in the list — reused by Home (latest
// application only) and My Applications / Application Detail (every
// application) so the 5-segment progress bar is computed identically
// everywhere.
export function useApplicationJourneys(
  applications: Application[] | null,
): Record<string, ApplicationJourneyState> {
  const { user } = useAuth()
  const [byId, setById] = useState<Record<string, ApplicationJourneyState>>({})

  // Callers often pass a fresh array every render (e.g. `app ? [app] : null`),
  // so the effect keys on the applications' content rather than the array's
  // identity — keying on the array refetched on every render, and the
  // resulting setById re-render made that an endless request loop.
  const applicationsRef = useRef(applications)
  applicationsRef.current = applications
  const key = applications?.map((a) => `${a.id}:${a.status}:${a.updated_at}`).join(',') ?? ''
  const userId = user?.id

  useEffect(() => {
    const applications = applicationsRef.current
    if (!applications || applications.length === 0 || !userId) return
    const studentId = userId
    let cancelled = false

    async function load() {
      const [contracts, hasActiveResidence, protocolsByAppId] = await Promise.all([
        listMyContracts().catch(() => []),
        getMyResidence(studentId)
          .then(() => true)
          .catch(() => false),
        Promise.all(
          (applications ?? []).map(
            async (app) => [app.id, await getApplicationProtocol(app.id).catch(() => null)] as const,
          ),
        ).then((entries) => new Map<string, Protocol | null>(entries)),
      ])
      if (cancelled) return

      const next: Record<string, ApplicationJourneyState> = {}
      for (const app of applications ?? []) {
        const contract = contracts.find((c) => c.application_id === app.id) ?? null
        const protocol = protocolsByAppId.get(app.id) ?? null
        next[app.id] = { contract, step: computeJourneyStep(app.status, protocol, contract, hasActiveResidence) }
      }
      setById(next)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [key, userId])

  return byId
}
