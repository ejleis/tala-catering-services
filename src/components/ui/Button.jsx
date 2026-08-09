import { Link } from 'react-router-dom'
import { SpinnerIcon } from './Icons.jsx'

const VARIANTS = {
  primary:
    'bg-brand-500 text-white shadow-sm hover:bg-brand-600 hover:-translate-y-0.5 hover:shadow-md',
  outline:
    'bg-transparent text-ink-900 border border-ink-200 hover:border-brand-500 hover:text-brand-700 hover:-translate-y-0.5',
  subtle: 'bg-ink-100 text-ink-700 hover:bg-ink-200',
  ghostLight:
    'bg-white/15 text-white border border-white/40 backdrop-blur hover:bg-white/25 hover:-translate-y-0.5',
  onDark: 'bg-white text-plum-900 hover:-translate-y-0.5 hover:shadow-md',
}

const SIZES = {
  sm: 'px-4 py-2 text-xs',
  md: 'px-6 py-3 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap ' +
  'transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0'

/**
 * Polymorphic button.
 *
 * - `to`   renders a react-router <Link> (internal navigation)
 * - `href` renders an <a>; external links get rel="noopener noreferrer" so the
 *   opened page cannot reach back through window.opener (reverse tabnabbing).
 * - otherwise renders a <button>, defaulting to type="button" so it never
 *   submits a surrounding form by accident.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  to,
  href,
  type,
  disabled,
  ...props
}) {
  const classes = `${BASE} ${VARIANTS[variant] ?? VARIANTS.primary} ${SIZES[size] ?? SIZES.md} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  if (href) {
    const isExternal = /^https?:\/\//i.test(href)
    return (
      <a
        href={href}
        className={classes}
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...props}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <SpinnerIcon size={16} />}
      {children}
    </button>
  )
}
