import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Reads a one-time message passed with navigate(path, { state: { message } }) and clears it
 * from browser history, so reloading the page does not show it again.
 */
export function useFlashMessage(): string | null {
  const location = useLocation()
  const navigate = useNavigate()
  const [message] = useState(() => (location.state as { message?: string } | null)?.message ?? null)

  useEffect(() => {
    if ((location.state as { message?: string } | null)?.message) {
      navigate(location.pathname + location.search, { replace: true, state: null })
    }
  }, [location.pathname, location.search, location.state, navigate])

  return message
}
