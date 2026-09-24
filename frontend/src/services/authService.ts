import { useAuthStore } from '../store/authStore'
import type { ApiSuccess } from '../types/api.types'
import type { CurrentUser, User } from '../types/user.types'
import { api } from './api'

export interface SignupInput {
  role: 'CUSTOMER' | 'CHEF'
  firstName: string
  lastName: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

type SessionResponse = ApiSuccess<{ user: User; accessToken: string }>

export async function signup(input: SignupInput): Promise<User> {
  const { data } = await api.post<SessionResponse>('/auth/register', input)
  useAuthStore.getState().setSession(data.data.user, data.data.accessToken)
  return data.data.user
}

export async function login(input: LoginInput): Promise<User> {
  const { data } = await api.post<SessionResponse>('/auth/login', input)
  useAuthStore.getState().setSession(data.data.user, data.data.accessToken)
  return data.data.user
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    useAuthStore.getState().clearSession()
  }
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await api.get<ApiSuccess<{ user: CurrentUser }>>('/users/me')
  return data.data.user
}
