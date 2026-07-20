import { useEffect, useState } from 'react'
import { getMyResidence } from '../../api/residenceApi'
import { useAuth } from '../auth/useAuth'

// "settled" means the student currently occupies an active room
// (room_residents with moved_out_at IS NULL) — used to conditionally show
// the "Менің орналасуым" sidebar link and to swap the "apply for a
// dormitory" wizard for the transfer/exit request forms. Checking the live
// residence rather than the application's historical status matters: once a
// manager approves the student's exit request, moved_out_at is set and this
// correctly flips back to false, letting the student submit a fresh
// application — an application's status stays 'settled' forever even after
// the student has moved out.
export function useIsSettled(): boolean {
  const { user } = useAuth()
  const [isSettled, setIsSettled] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getMyResidence(user.id)
      .then(() => {
        if (!cancelled) setIsSettled(true)
      })
      .catch(() => {
        if (!cancelled) setIsSettled(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  return isSettled
}
