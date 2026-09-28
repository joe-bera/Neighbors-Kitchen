import { useEffect, useState } from 'react'
import PageLoader from '../../components/common/PageLoader'
import { EmptyState, ErrorState } from '../../components/common/StatusStates'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePageTitle } from '../../hooks/usePageTitle'
import { fetchPracticeEmail, fetchPracticeEmails } from '../../services/practiceMailboxService'
import type { PracticeEmailStatus } from '../../types/notification.types'
import { withLinksInNewTab } from '../../utils/practiceMailbox'
import { timeAgo } from '../../utils/timeAgo'
import './PracticeMailbox.css'

const CHECK_EVERY_MS = 5_000

const STATUS_WORDS: Record<PracticeEmailStatus, string> = {
  PENDING: 'Waiting to send',
  SENDING: 'Sending',
  SENT: 'Sent',
  FAILED: 'Failed',
}

/** Development only: every email the app has written, shown as it would look. Nothing leaves this computer. */
export default function PracticeMailboxPage() {
  usePageTitle('Practice mailbox')
  const emails = useAsyncData('practice-emails', fetchPracticeEmails)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { retry } = emails

  // New emails show up within a few seconds.
  useEffect(() => {
    const timer = window.setInterval(retry, CHECK_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [retry])

  if (emails.status === 'error' && !emails.data) {
    return (
      <div className="container">
        <ErrorState message={emails.error ?? ''} onRetry={retry} />
      </div>
    )
  }
  if (!emails.data) return <PageLoader label="Loading the practice mailbox" />

  const current = emails.data.find((email) => email.id === selectedId) ?? emails.data[0]

  return (
    <div className="container practice-mailbox">
      <header className="practice-mailbox-header">
        <h1>Practice mailbox</h1>
        <p className="card-text">
          Every email the app sends while we build it lands here, newest first. Nothing leaves this computer, and this page does not exist on the live site.
        </p>
      </header>

      {emails.data.length === 0 ? (
        <EmptyState title="No emails yet" text="Place an order or ask for a password reset, and the emails show up here within a few seconds." />
      ) : (
        <div className="practice-mailbox-layout">
          <ul className="practice-mailbox-list">
            {emails.data.map((email) => (
              <li key={email.id}>
                <button
                  type="button"
                  className={`practice-mailbox-item${email.id === current?.id ? ' is-selected' : ''}`}
                  aria-pressed={email.id === current?.id}
                  onClick={() => setSelectedId(email.id)}
                >
                  <span className="practice-mailbox-subject">{email.subject ?? `${email.kind} (being written)`}</span>
                  <span className="practice-mailbox-meta">
                    To {email.to} · {timeAgo(email.createdAt)}
                  </span>
                  {email.status !== 'SENT' && (
                    <span className={`practice-mailbox-status practice-mailbox-status--${email.status.toLowerCase()}`}>
                      {STATUS_WORDS[email.status]}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {/* Loads again when the email's status changes, e.g. once it has been written. */}
          {current && <EmailPreview key={`${current.id}:${current.status}`} id={current.id} />}
        </div>
      )}
    </div>
  )
}

function EmailPreview({ id }: { id: string }) {
  const email = useAsyncData(`practice-email:${id}`, () => fetchPracticeEmail(id))
  const [view, setView] = useState<'email' | 'text'>('email')

  if (email.status === 'error' && !email.data) return <ErrorState message={email.error ?? ''} onRetry={email.retry} />
  if (!email.data) return <PageLoader label="Loading the email" />
  const { data } = email

  return (
    <section className="card practice-mailbox-preview" aria-label="Email preview">
      <p className="practice-mailbox-preview-subject">{data.subject ?? 'Not written yet'}</p>
      <p className="card-text">To {data.to}</p>
      {data.lastError && <div className="alert alert-error" role="alert">{data.lastError}</div>}
      <div className="practice-mailbox-tabs" role="group" aria-label="Show the email as">
        <button type="button" className={`btn btn-small ${view === 'email' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'email'} onClick={() => setView('email')}>
          Email
        </button>
        <button type="button" className={`btn btn-small ${view === 'text' ? 'btn-primary' : 'btn-outline'}`} aria-pressed={view === 'text'} onClick={() => setView('text')}>
          Plain text
        </button>
      </div>
      {view === 'email' ? (
        data.html ? (
          <iframe
            className="practice-mailbox-frame"
            title={`Email: ${data.subject ?? data.kind}`}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            srcDoc={withLinksInNewTab(data.html)}
          />
        ) : (
          <p className="card-text">This email has not been written yet. It will appear in a few seconds.</p>
        )
      ) : (
        <pre className="practice-mailbox-text">{data.text ?? 'Not written yet.'}</pre>
      )}
    </section>
  )
}
