import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFoundPage() {
  usePageTitle('Page not found')

  return (
    <div className="container" style={{ textAlign: 'center', padding: '3rem 0' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Page not found</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
        We could not find the page you were looking for.
      </p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  )
}
