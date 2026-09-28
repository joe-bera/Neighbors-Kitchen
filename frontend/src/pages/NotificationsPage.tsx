import { useEffect } from 'react'
import PageLoader from '../components/common/PageLoader'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import NotificationItem from '../components/notifications/NotificationItem'
import '../components/notifications/Notifications.css'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchNotifications, markAllNotificationsRead } from '../services/notificationService'
import { useNotificationStore } from '../store/notificationStore'

const PAGE_SIZE = 50

export default function NotificationsPage() {
  usePageTitle('Notifications')
  const list = useAsyncData('notifications', () => fetchNotifications(PAGE_SIZE))
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)
  const hasUnread = (list.data?.unreadCount ?? 0) > 0

  // Everything on this page counts as seen.
  useEffect(() => {
    if (!hasUnread) return
    markAllNotificationsRead().then(
      () => setUnreadCount(0),
      () => {}, // the bell will still show them; nothing else to do
    )
  }, [hasUnread, setUnreadCount])

  if (list.status === 'error' && !list.data) {
    return (
      <div className="container">
        <ErrorState message={list.error ?? ''} onRetry={list.retry} />
      </div>
    )
  }
  if (!list.data) return <PageLoader label="Loading your notifications" />

  return (
    <div className="container notifications-page">
      <h1>Notifications</h1>
      {list.data.notifications.length === 0 ? (
        <EmptyState title="Nothing yet" text="We'll let you know here when something happens with your orders, reviews or dish requests." />
      ) : (
        <ul className="notification-list">
          {list.data.notifications.map((item) => (
            <li key={item.id}>
              <NotificationItem notification={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
