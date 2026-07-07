import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  setSession: (user: User, accessToken: string) => void
  setAccessToken: (accessToken: string) => void
  clear: () => void
}

// accessToken lives only in memory (this store), never in localStorage — it's
// gone on a hard refresh, which is why App.tsx tries a refresh-token bootstrap
// on mount. Only the refresh_token is persisted (see tokenStorage.ts).
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setSession: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}))
