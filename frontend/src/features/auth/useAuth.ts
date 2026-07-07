import { useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import {
  getRefreshToken,
  setRefreshToken,
  clearRefreshToken,
  setStoredUser,
  clearStoredUser,
} from '../../store/tokenStorage'
import * as authApi from '../../api/authApi'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSession = useAuthStore((s) => s.setSession)
  const clear = useAuthStore((s) => s.clear)

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login({ email, password })
      setRefreshToken(result.refresh_token)
      setStoredUser(result.user)
      setSession(result.user, result.access_token)
      return result.user
    },
    [setSession],
  )

  const register = useCallback(async (payload: authApi.RegisterPayload) => {
    return authApi.register(payload)
  }, [])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } finally {
      clearRefreshToken()
      clearStoredUser()
      clear()
    }
  }, [clear])

  return { user, isAuthenticated, login, register, logout }
}
