import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Restores scroll position on route change.
 *
 * Without this, navigating from a scrolled page to a new route leaves the user
 * mid-page. Hash links (e.g. /#menu) are left alone so anchor scrolling works.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.slice(1))
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return null
}
