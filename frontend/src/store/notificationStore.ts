import { create } from 'zustand'

interface NotificationState {
  /** How many notifications are unread; shown on the bell. */
  unreadCount: number
  setUnreadCount: (unreadCount: number) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}))
