import axios, { type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'
import type { ApiFailure, ApiSuccess } from '../types/api.types'
import type { User } from '../types/user.types'

/** In development VITE_API_URL is empty and Vite forwards /api to the backend. */
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api/v1`,
  timeout: Number(import.meta.env.VITE_API_TIMEOUT ?? 10000),
  withCredentials: true,
})

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let refreshInFlight: Promise<string | null> | null = null

/**
 * Uses the refresh cookie to get a new access token and stores the session.
 * Resolves to null (and marks the visitor as logged out) when there is no valid session.
 * Callers that arrive while a refresh is running share the same request.
 */
export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= api
    .post<ApiSuccess<{ user: User; accessToken: string }>>('/auth/refresh-token')
    .then(({ data }) => {
      useAuthStore.getState().setSession(data.data.user, data.data.accessToken)
      return data.data.accessToken
    })
    .catch(() => {
      useAuthStore.getState().clearSession()
      return null
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

type RetryableRequest = InternalAxiosRequestConfig & { _retried?: boolean }

// When the short-lived access token has expired, refresh it once and replay the request.
api.interceptors.response.use(undefined, async (error) => {
  const request = error.config as RetryableRequest | undefined
  const failure = error.response?.data as ApiFailure | undefined
  if (error.response?.status === 401 && failure?.error?.code === 'TOKEN_EXPIRED' && request && !request._retried) {
    request._retried = true
    const accessToken = await refreshSession()
    if (accessToken) {
      return api(request)
    }
  }
  return Promise.reject(error)
})
