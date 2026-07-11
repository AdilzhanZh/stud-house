import { useEffect, useState } from 'react'
import { listPendingStudents } from '../../../api/adminUserApi'

const POLL_INTERVAL_MS = 30_000

// Mirrors useUnreadCount's polling pattern for the notifications badge —
// same MVP tradeoff (poll instead of push) applied to the admin sidebar's
// "Күтіп тұрған тіркелгілер" link.
export function usePendingStudentsCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
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
  }, [])

  return count
}
