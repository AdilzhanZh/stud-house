import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getStoredUser,
  clearStoredUser,
} from '../../store/tokenStorage'
import * as authApi from '../../api/authApi'

// On a hard page load the in-memory access token (and the store holding it)
// is gone. If a refresh_token + cached user are still in localStorage, this
// silently exchanges the refresh token for a new access token and restores
// the session — otherwise the user is treated as logged out.
export function useAuthBootstrap(): boolean {
  const [isReady, setIsReady] = useState(false)
  const setSession = useAuthStore((s) => s.setSession)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const refreshToken = getRefreshToken()
      const cachedUser = getStoredUser()
      if (!refreshToken || !cachedUser) {
        setIsReady(true)
        return
      }
      try {
        const pair = await authApi.refresh(refreshToken)
        if (cancelled) return
        setRefreshToken(pair.refresh_token)
        setSession(cachedUser, pair.access_token)
      } catch {
        clearRefreshToken()
        clearStoredUser()
      } finally {
        if (!cancelled) setIsReady(true)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [setSession])

  return isReady
}
