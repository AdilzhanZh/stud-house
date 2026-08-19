import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import i18n from '../i18n'
import { useAuthStore } from '../store/authStore'
import { getRefreshToken, setRefreshToken, clearRefreshToken } from '../store/tokenStorage'
import type { TokenPair } from '../types'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1'

export const apiClient = axios.create({ baseURL })

// Plain axios instance (no interceptors) used only for the refresh call
// itself, so a failing refresh never re-triggers the 401 handler below.
const refreshClient = axios.create({ baseURL })

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  // Every apperror.* message on the backend is written in Kazakh — this
  // header is how it knows to translate it into the caller's UI language
  // before responding (see backend middleware.DetectLanguage / pkg/apperror
  // Translate) instead of leaving that to the frontend.
  config.headers.set('Accept-Language', i18n.language)
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Concurrent 401s must not each fire their own refresh call — the first one
// in starts the refresh and every other request awaits the same promise.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error('no refresh token available')
  }
  const { data } = await refreshClient.post<{ data: TokenPair }>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  useAuthStore.getState().setAccessToken(data.data.access_token)
  setRefreshToken(data.data.refresh_token)
  return data.data.access_token
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined
    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error)
    }
    // No refresh token to retry with — e.g. a plain wrong-password 401 from
    // POST /auth/login while logged out. Without this check, the code below
    // still tried to refresh, which threw a plain "no refresh token
    // available" Error that replaced the real backend message (translated
    // per Accept-Language) with a generic fallback everywhere this ran.
    if (!getRefreshToken()) {
      return Promise.reject(error)
    }
    original._retry = true

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })
      const newToken = await refreshPromise
      original.headers.set('Authorization', `Bearer ${newToken}`)
      return apiClient.request(original)
    } catch (refreshError) {
      useAuthStore.getState().clear()
      clearRefreshToken()
      return Promise.reject(refreshError)
    }
  },
)

// 413 never reaches the backend (nginx/the server rejects the oversized
// body before any handler runs), so it's the one error message this file
// still has to translate itself rather than relying on the backend.
const FILE_TOO_LARGE: Record<string, string> = {
  kk: 'Файл өлшемі тым үлкен (ең көбі 15 МБ), кішірек файл таңдаңыз',
  ru: 'Файл слишком большой (максимум 15 МБ), выберите файл поменьше',
  en: 'The file is too large (15 MB max), please choose a smaller file',
}

// getErrorCode reads the backend's apperror.Code off an axios error (e.g.
// "email_unverifiable"), so callers can branch on the specific failure
// instead of just displaying its message.
export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code
  }
  return undefined
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 413) {
      return FILE_TOO_LARGE[i18n.language] ?? FILE_TOO_LARGE.kk
    }
    // Already translated server-side into the Accept-Language this client
    // sent (see the request interceptor above), so no client-side
    // translation step is needed here.
    const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error
      ?.message
    if (message) return message
  }
  return fallback
}
