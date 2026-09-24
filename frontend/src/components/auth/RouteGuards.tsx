import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types/user.types'
import { getSafeRedirect } from '../../utils/safeRedirect'
import PageLoader from '../common/PageLoader'

interface ProtectedRouteProps {
  children: ReactNode
  /** Limit the page to these roles. */
  roles?: UserRole[]
  /** Where signed-in users without one of the roles are sent. */
  otherRolesRedirectTo?: string
}

/** Only for signed-in users; others are sent to the login page and brought back afterwards. */
export function ProtectedRoute({ children, roles, otherRolesRedirectTo = '/' }: ProtectedRouteProps) {
  const { status, user } = useAuthStore()
  const location = useLocation()

  if (status === 'loading') return <PageLoader />
  if (status === 'anonymous') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  if (roles && user && !roles.includes(user.role)) return <Navigate to={otherRolesRedirectTo} replace />
  return children
}

/** Only for visitors who are not signed in, such as the login and sign-up pages. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status)
  const [searchParams] = useSearchParams()

  if (status === 'loading') return <PageLoader />
  if (status === 'authenticated') {
    return <Navigate to={getSafeRedirect(searchParams.get('redirect'), '/account')} replace />
  }
  return children
}
