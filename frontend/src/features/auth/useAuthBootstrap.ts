import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  getStoredUser,
  setStoredUser,
  clearStoredUser,
  decodeAccessTokenClaims,
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

        // The refresh response only carries tokens, not the user profile,
        // but the new access token's claims are authoritative for role/
        // committee flags — reconcile them onto the cached user so a
        // promotion/demotion since the last login isn't silently ignored.
        const claims = decodeAccessTokenClaims(pair.access_token)
        const user = claims
          ? {
              ...cachedUser,
              role: claims.role,
              is_committee_member: claims.is_committee_member,
              is_chairperson: claims.is_chairperson,
            }
          : cachedUser
        if (claims) setStoredUser(user)

        setSession(user, pair.access_token)
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
