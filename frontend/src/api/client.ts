import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
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

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 413) {
      return 'Файл өлшемі тым үлкен (ең көбі 15 МБ), кішірек файл таңдаңыз'
    }
    const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error
      ?.message
    if (message) return message
  }
  return fallback
}
