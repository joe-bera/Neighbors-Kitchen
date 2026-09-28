/** One item under the bell. */
export interface AppNotification {
  id: string
  kind: string
  title: string
  body: string | null
  /** Where tapping it goes, e.g. /orders/<id>. */
  link: string
  createdAt: string
  read: boolean
}

export interface NotificationList {
  notifications: AppNotification[]
  unreadCount: number
}

/** The optional emails a person can turn off. Order and password emails always go out. */
export interface EmailSettings {
  rateReminders: boolean
  dishRequestNews: boolean
  kitchenFeedback: boolean
}

export type PracticeEmailStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED'

/** An email in the practice mailbox (development only). */
export interface PracticeEmail {
  id: string
  to: string
  kind: string
  /** Null until the email is written, a few seconds after it is queued. */
  subject: string | null
  status: PracticeEmailStatus
  attempts: number
  lastError: string | null
  createdAt: string
  sentAt: string | null
}

export interface PracticeEmailDetail extends PracticeEmail {
  html: string | null
  text: string | null
}
