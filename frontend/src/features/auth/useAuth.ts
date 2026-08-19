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
import type { User } from '../../types'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSession = useAuthStore((s) => s.setSession)
  const setUserInStore = useAuthStore((s) => s.setUser)
  const clear = useAuthStore((s) => s.clear)

  const login = useCallback(
    async (loginValue: string, password: string) => {
      const result = await authApi.login({ login: loginValue, password })
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

  // Patches the cached user (e.g. after an avatar upload) without touching
  // the access token — updates both the in-memory store and the localStorage
  // cache useAuthBootstrap restores on a hard reload.
  const updateUser = useCallback(
    (updated: User) => {
      setStoredUser(updated)
      setUserInStore(updated)
    },
    [setUserInStore],
  )

  return { user, isAuthenticated, login, register, logout, updateUser }
}
