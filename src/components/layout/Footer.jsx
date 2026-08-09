import { Link } from 'react-router-dom'
import { BUSINESS } from '../../data/site.js'
import { TalaMark } from '../ui/Icons.jsx'
import { Container } from '../ui/Section.jsx'

const EXPLORE = [
  { label: 'Services', to: '/#services' },
  { label: 'Menu', to: '/#menu' },
  { label: 'Packages', to: '/#packages' },
  { label: 'Gallery', to: '/#gallery' },
]

const HOTEL_LINKS = [
  { label: 'All Hotels', to: '/hotels' },
  { label: 'Swiss-Belhotel Blulane', to: '/hotels/swiss-belhotel-blulane' },
  { label: 'Bay Area Suites Manila', to: '/hotels/bay-area-suites-manila' },
  { label: 'Red Hotel Cubao', to: '/hotels/red-hotel-cubao' },
]

export default function Footer() {
  return (
    <footer className="bg-ink-900 pb-6 pt-14 text-white/70">
      <Container>
        <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-white">
              <TalaMark className="h-6 w-6 text-brand-400" />
              {BUSINESS.shortName}
            </div>
            <p className="max-w-xs text-sm">{BUSINESS.tagline}</p>
          </div>

          <div>
            <h2 className="mb-4 font-display text-base font-semibold text-white">Explore</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {EXPLORE.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-display text-base font-semibold text-white">Hotels</h2>
            <ul className="flex flex-col gap-3 text-sm">
              {HOTEL_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-display text-base font-semibold text-white">Contact</h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <a href={`mailto:${BUSINESS.email}`} className="hover:text-white">
                  {BUSINESS.email}
                </a>
              </li>
              <li>
                <a href={`tel:${BUSINESS.phone.replace(/\s/g, '')}`} className="hover:text-white">
                  {BUSINESS.phone}
                </a>
              </li>
              <li>{BUSINESS.address}</li>
              <li>{BUSINESS.hours}</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs">
          <span>
            &copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.
          </span>
          <span className="text-white/50">
            Hotel rates and availability shown are demo data pending confirmation.
          </span>
        </div>
      </Container>
    </footer>
  )
}
