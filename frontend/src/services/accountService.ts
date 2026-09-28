import type { ApiSuccess } from '../types/api.types'
import type { EmailSettings } from '../types/notification.types'
import { api } from './api'

// Account settings and password recovery.

/** Turns optional emails on or off; returns all the settings as saved. */
export async function updateEmailSettings(changes: Partial<EmailSettings>): Promise<EmailSettings> {
  const { data } = await api.put<ApiSuccess<{ emailSettings: EmailSettings }>>('/users/me/email-settings', changes)
  return data.data.emailSettings
}

/** Asks for a reset link. The answer is the same whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await api.post<ApiSuccess<null>>('/auth/forgot-password', { email })
  return data.message ?? "If there's an account for that email, we sent a link to reset the password."
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password })
}
