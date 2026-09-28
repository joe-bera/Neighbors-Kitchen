import type { ApiSuccess } from '../types/api.types'
import type { NotificationList } from '../types/notification.types'
import { api } from './api'

export async function fetchNotifications(limit: number): Promise<NotificationList> {
  const { data } = await api.get<ApiSuccess<NotificationList>>('/notifications', { params: { limit } })
  return data.data
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<ApiSuccess<{ unreadCount: number }>>('/notifications/unread-count')
  return data.data.unreadCount
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all')
}
