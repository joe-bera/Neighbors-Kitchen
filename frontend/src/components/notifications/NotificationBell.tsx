import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead } from '../../services/notificationService'
import { useNotificationStore } from '../../store/notificationStore'
import type { AppNotification } from '../../types/notification.types'
import { getApiError } from '../../utils/apiError'
import NotificationItem from './NotificationItem'
import './Notifications.css'

const CHECK_EVERY_MS = 60_000
const PANEL_SIZE = 8

/** The bell in the menu bar: how many updates are unread, and the latest ones in a drop-down. */
export default function NotificationBell() {
  const { pathname } = useLocation()
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Check for news whenever the page changes, and once a minute.
  useEffect(() => {
    let cancelled = false
    const check = () => {
      fetchUnreadCount().then(
        (count) => {
          if (!cancelled) setUnreadCount(count)
        },
        () => {}, // try again at the next check
      )
    }
    check()
    const timer = window.setInterval(check, CHECK_EVERY_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [pathname, setUnreadCount])

  // Escape or a click outside closes the drop-down.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open])

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setItems(null)
    setError(null)
    try {
      const list = await fetchNotifications(PANEL_SIZE)
      setItems(list.notifications)
      if (list.unreadCount > 0) {
        await markAllNotificationsRead()
        setUnreadCount(0)
      }
    } catch (loadError) {
      setError(getApiError(loadError).message)
    }
  }

  return (
    <div className="bell" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className="bell-button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="bell-panel"
        onClick={toggle}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="bell-count" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div id="bell-panel" className="bell-panel" role="region" aria-label="Latest notifications">
          <p className="bell-panel-title">Notifications</p>
          {error ? (
            <p className="bell-panel-message" role="alert">{error}</p>
          ) : items === null ? (
            <p className="bell-panel-message">Loading...</p>
          ) : items.length === 0 ? (
            <p className="bell-panel-message">Nothing yet. We&apos;ll let you know when something happens.</p>
          ) : (
            <ul className="notification-list">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationItem notification={item} onOpen={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="bell-panel-all" onClick={() => setOpen(false)}>
            See all
          </Link>
        </div>
      )}
    </div>
  )
}
