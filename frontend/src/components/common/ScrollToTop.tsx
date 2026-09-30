import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scrolls to the top on page changes, or to the #section in the URL when there is one. */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    const target = hash ? document.getElementById(hash.slice(1)) : null
    if (target) {
      target.scrollIntoView()
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])

  return null
}
