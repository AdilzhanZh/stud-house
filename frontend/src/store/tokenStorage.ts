import type { User } from '../types'

// refresh_token is the only *credential* kept in localStorage (the backend
// has no httpOnly-cookie option — it returns both tokens in the JSON body).
// This is standard for SPAs without a BFF, but it is readable by any script
// on the page, so an XSS bug becomes a session-theft bug. See README.
const REFRESH_TOKEN_KEY = 'student_house_refresh_token'

// There is no GET /auth/me endpoint and the access-token JWT only carries
// sub/role/is_chairperson (see pkg/jwtutil/access.go) — not full_name/email/
// phone. So a hard page reload (which wipes the in-memory access token and
// the zustand store with it) has no way to re-fetch "who is this user".
// We cache the last-known user object (no password hash ever reaches the
// frontend) alongside the refresh token purely so App.tsx can restore the
// session header without a dedicated backend endpoint.
const USER_CACHE_KEY = 'student_house_user'

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_CACHE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_CACHE_KEY)
}
