import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { AppNotification } from '../types/notification.types'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from './notificationService'

const API = 'http://api.test/api/v1'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const confirmed: AppNotification = {
  id: 'n1',
  kind: 'ORDER_CONFIRMED',
  title: "Abuela's Table confirmed your order",
  body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM',
  link: '/orders/o1',
  createdAt: '2026-09-29T20:00:00.000Z',
  read: false,
}

describe('notificationService', () => {
  it('asks for the latest notifications, up to the limit', async () => {
    let limit: string | null = null
    server.use(
      http.get(`${API}/notifications`, ({ request }) => {
        limit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json({ success: true, data: { notifications: [confirmed], unreadCount: 1 } })
      }),
    )

    expect(await fetchNotifications(8)).toEqual({ notifications: [confirmed], unreadCount: 1 })
    expect(limit).toBe('8')
  })

  it('reads the unread count', async () => {
    server.use(http.get(`${API}/notifications/unread-count`, () => HttpResponse.json({ success: true, data: { unreadCount: 4 } })))

    expect(await fetchUnreadCount()).toBe(4)
  })

  it('marks everything read', async () => {
    let called = false
    server.use(
      http.post(`${API}/notifications/read-all`, () => {
        called = true
        return HttpResponse.json({ success: true, data: { unreadCount: 0 } })
      }),
    )

    await markAllNotificationsRead()

    expect(called).toBe(true)
  })
})
