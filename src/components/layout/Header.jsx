import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BUSINESS, NAV_LINKS } from '../../data/site.js'
import { MenuIcon, CloseIcon, TalaMark } from '../ui/Icons.jsx'
import Button from '../ui/Button.jsx'
import { Container } from '../ui/Section.jsx'

export default function Header() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Close the mobile menu whenever the route changes.
  useEffect(() => setOpen(false), [pathname])

  // Close on Escape — expected behaviour for any dismissible overlay.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/85 backdrop-blur-md">
      <Container>
        <nav className="flex items-center justify-between py-3.5" aria-label="Primary">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <TalaMark className="h-7 w-7 text-brand-500" />
            <span>{BUSINESS.name}</span>
          </Link>

          <ul className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.to}>
                {link.to.startsWith('/#') ? (
                  <Link
                    to={link.to}
                    className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    className={({ isActive }) =>
                      `text-sm font-medium transition-colors ${
                        isActive ? 'text-brand-600' : 'text-ink-500 hover:text-ink-900'
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <Button to="/#inquire" size="sm">
              Request a Quote
            </Button>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center lg:hidden"
            aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </nav>
      </Container>

      {open && (
        <div id="mobile-nav" className="border-t border-ink-200 bg-white lg:hidden">
          <Container>
            <ul className="flex flex-col py-2">
              {NAV_LINKS.map((link) => (
                <li key={link.to} className="border-b border-ink-100 last:border-0">
                  <Link to={link.to} className="block py-3 text-base font-medium text-ink-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Button to="/#inquire" className="mb-4 w-full">
              Request a Quote
            </Button>
          </Container>
        </div>
      )}
    </header>
  )
}
