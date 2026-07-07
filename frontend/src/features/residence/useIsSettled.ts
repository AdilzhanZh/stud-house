import { useEffect, useState } from 'react'
import { listMyPayments } from '../../api/paymentApi'

// "settled" per spec means the student has at least one confirmed payment —
// used to conditionally show the "Менің орналасуым" sidebar link.
export function useIsSettled(): boolean {
  const [isSettled, setIsSettled] = useState(false)

  useEffect(() => {
    let cancelled = false
    listMyPayments()
      .then((payments) => {
        if (!cancelled) setIsSettled(payments.some((p) => p.status === 'confirmed'))
      })
      .catch(() => {
        // Not settled (or a transient error) — default to hidden.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return isSettled
}
