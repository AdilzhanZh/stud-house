import { useEffect, useState } from 'react'
import { listNotifications } from '../../api/notificationApi'

const POLL_INTERVAL_MS = 30_000

// MVP polling instead of WebSockets, per spec — every 30s while mounted
// (i.e. while the dashboard layout is on screen).
export function useUnreadCount(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const list = await listNotifications()
        if (!cancelled) setCount(list.filter((n) => !n.is_read).length)
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
