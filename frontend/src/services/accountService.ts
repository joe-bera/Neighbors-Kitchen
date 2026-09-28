import type { ApiSuccess } from '../types/api.types'
import type { EmailSettings } from '../types/notification.types'
import { api } from './api'

// Account settings and password recovery.

/** Turns optional emails on or off; returns all the settings as saved. */
export async function updateEmailSettings(changes: Partial<EmailSettings>): Promise<EmailSettings> {
  const { data } = await api.put<ApiSuccess<{ emailSettings: EmailSettings }>>('/users/me/email-settings', changes)
  return data.data.emailSettings
}
