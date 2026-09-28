import type { ApiSuccess } from '../types/api.types'
import type { PracticeEmail, PracticeEmailDetail } from '../types/notification.types'
import { api } from './api'

// Development only: the emails the app has written, from /api/v1/dev/emails.

export async function fetchPracticeEmails(): Promise<PracticeEmail[]> {
  const { data } = await api.get<ApiSuccess<{ emails: PracticeEmail[] }>>('/dev/emails')
  return data.data.emails
}

export async function fetchPracticeEmail(id: string): Promise<PracticeEmailDetail> {
  const { data } = await api.get<ApiSuccess<{ email: PracticeEmailDetail }>>(`/dev/emails/${encodeURIComponent(id)}`)
  return data.data.email
}
