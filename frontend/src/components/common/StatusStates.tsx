import type { ReactNode } from 'react'

export function ErrorState({ message, onRetry, children }: { message: string; onRetry?: () => void; children?: ReactNode }) {
  return (
    <div className="status-state" role="alert">
      <p className="status-state-title">{message}</p>
      <div className="status-state-actions">
        {onRetry && (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="status-state">
      <p className="status-state-title">{title}</p>
      {text && <p className="status-state-text">{text}</p>}
      {children && <div className="status-state-actions">{children}</div>}
    </div>
  )
}
