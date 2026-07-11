import { useEffect, useState } from 'react'
import { listApplications } from '../../../api/applicationAdminApi'
import { getApplicationsLastSeenAt, onApplicationsSeen } from './applicationsSeen'

const POLL_INTERVAL_MS = 30_000

// Mirrors usePendingStudentsCount's polling pattern, applied to the admin
// sidebar's "Өтініш кезегі" link — but counts only applications that arrived
// after the manager last viewed the queue's pending tab, not every pending
// application, so the badge clears once they've seen the new ones.
export function usePendingApplicationsCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const list = await listApplications('pending')
        const lastSeenAt = getApplicationsLastSeenAt()
        if (!cancelled) {
          setCount(list.filter((a) => new Date(a.created_at).getTime() > lastSeenAt).length)
        }
      } catch {
        // Network hiccup: keep the last known count rather than flashing to 0.
      }
    }

    void poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    const unsubscribe = onApplicationsSeen(poll)
    return () => {
      cancelled = true
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  return count
}
