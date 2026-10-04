import { useEffect, useState } from 'react'
import { listPendingStudents } from '../../../api/adminUserApi'

const POLL_INTERVAL_MS = 30_000

// Mirrors useUnreadCount's polling pattern for the notifications badge —
// same MVP tradeoff (poll instead of push) applied to the admin sidebar's
// "Күтіп тұрған тіркелгілер" link.
// enabled=false skips polling entirely, for staff without access to the
// underlying (manager-only) endpoint.
export function usePendingStudentsCount(enabled = true): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function poll() {
      try {
        const list = await listPendingStudents()
        if (!cancelled) setCount(list.length)
      } catch {
        // Network hiccup: keep the last known count rather than flashing to 0.
      }
    }

    void poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [enabled])

  return count
}
