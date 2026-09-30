import { Link } from 'react-router-dom'
import type { AppNotification } from '../../types/notification.types'
import { timeAgo } from '../../utils/timeAgo'

interface NotificationItemProps {
  notification: AppNotification
  /** Called when the item is opened, e.g. to close the bell's drop-down. */
  onOpen?: () => void
}

/** One update, in the bell or on the notifications page. Unread ones stand out. */
export default function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  return (
    <Link
      to={notification.link}
      className={`notification-item${notification.read ? '' : ' notification-item--unread'}`}
      onClick={onOpen}
    >
      <span className="notification-item-title">
        {!notification.read && <span className="visually-hidden">New: </span>}
        {notification.title}
      </span>
      {notification.body && <span className="notification-item-body">{notification.body}</span>}
      <span className="notification-item-time">{timeAgo(notification.createdAt)}</span>
    </Link>
  )
}
