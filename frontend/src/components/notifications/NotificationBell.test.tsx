// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../../services/notificationService'
import { useNotificationStore } from '../../store/notificationStore'
import type { AppNotification } from '../../types/notification.types'
import NotificationBell from './NotificationBell'

// The bell talks to the API through these calls; replace them so no network is needed.
vi.mock('../../services/notificationService', () => ({
  fetchUnreadCount: vi.fn(),
  fetchNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
const unreadCount = vi.mocked(fetchUnreadCount)
const latest = vi.mocked(fetchNotifications)
const markAllRead = vi.mocked(markAllNotificationsRead)

const confirmed: AppNotification = {
  id: 'n1',
  kind: 'ORDER_CONFIRMED',
  title: "Abuela's Table confirmed your order",
  body: 'NK-7QX4PD · Tue, Sep 29 at 6:00 PM',
  link: '/orders/o1',
  createdAt: new Date().toISOString(),
  read: false,
}

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useNotificationStore.setState({ unreadCount: 0 })
  markAllRead.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('NotificationBell', () => {
  it('shows how many notifications are unread', async () => {
    unreadCount.mockResolvedValue(3)

    renderBell()

    await screen.findByRole('button', { name: 'Notifications, 3 unread' })
  })

  it('opens the latest notifications and marks them read', async () => {
    unreadCount.mockResolvedValue(1)
    latest.mockResolvedValue({ notifications: [confirmed], unreadCount: 1 })
    renderBell()

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))

    await screen.findByText("Abuela's Table confirmed your order")
    expect(latest).toHaveBeenCalledWith(8)
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1))
    await screen.findByRole('button', { name: 'Notifications' })
    expect(screen.getByRole('link', { name: /Abuela's Table confirmed your order/ }).getAttribute('href')).toBe('/orders/o1')
  })

  it('does not mark anything read when nothing is new', async () => {
    unreadCount.mockResolvedValue(0)
    latest.mockResolvedValue({ notifications: [{ ...confirmed, read: true }], unreadCount: 0 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    await screen.findByText("Abuela's Table confirmed your order")
    expect(markAllRead).not.toHaveBeenCalled()
  })

  it('says when there is nothing yet', async () => {
    unreadCount.mockResolvedValue(0)
    latest.mockResolvedValue({ notifications: [], unreadCount: 0 })
    renderBell()

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))

    await screen.findByText("Nothing yet. We'll let you know when something happens.")
  })

  it('closes with the Escape key', async () => {
    unreadCount.mockResolvedValue(0)
    latest.mockResolvedValue({ notifications: [confirmed], unreadCount: 0 })
    renderBell()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    await screen.findByText("Abuela's Table confirmed your order")

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByText("Abuela's Table confirmed your order")).toBeNull()
  })
})
