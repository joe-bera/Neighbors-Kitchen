import { beforeEach, describe, expect, it } from 'vitest'
import type { User } from '../types/user.types'
import { useAuthStore } from './authStore'
import { useNotificationStore } from './notificationStore'

const person = (id: string): User => ({
  id,
  email: `${id}@example.com`,
  role: 'CUSTOMER',
  firstName: 'Chris',
  lastName: 'Walker',
  phone: null,
  profilePhotoUrl: null,
  emailVerified: false,
  createdAt: '2026-09-01T00:00:00.000Z',
})

beforeEach(() => {
  useAuthStore.setState({ user: person('user-1'), accessToken: 'token-1', status: 'authenticated' })
  useNotificationStore.setState({ unreadCount: 3 })
})

describe('the bell count', () => {
  it('is forgotten when the person signs out', () => {
    useAuthStore.getState().clearSession()

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('is forgotten when someone else signs in', () => {
    useAuthStore.getState().setSession(person('user-2'), 'token-2')

    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('stays when the same person gets a fresh token', () => {
    useAuthStore.getState().setSession(person('user-1'), 'token-3')

    expect(useNotificationStore.getState().unreadCount).toBe(3)
  })
})
