import { create } from 'zustand'
import { useAuthStore } from './authStore'

interface NotificationState {
  /** How many notifications are unread; shown on the bell. */
  unreadCount: number
  setUnreadCount: (unreadCount: number) => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
}))

// Someone signed out, or someone else signed in: the old count belongs to another person.
useAuthStore.subscribe((state, previous) => {
  if ((state.user?.id ?? null) !== (previous.user?.id ?? null)) useNotificationStore.getState().setUnreadCount(0)
})
