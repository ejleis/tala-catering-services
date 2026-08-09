import { AlertIcon, CheckIcon } from './Icons.jsx'

const TONES = {
  success: {
    wrapper: 'border-green-200 bg-green-50 text-green-900',
    icon: 'text-green-700',
    Icon: CheckIcon,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
    Icon: AlertIcon,
  },
  info: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-700',
    Icon: AlertIcon,
  },
}

/**
 * Status message.
 *
 * `role="alert"` (assertive) is used for errors so they interrupt and are
 * announced immediately; success and info use role="status" (polite) so they
 * do not cut off whatever the screen reader is currently saying.
 */
export default function Alert({ tone = 'info', title, children, className = '' }) {
  const { wrapper, icon, Icon } = TONES[tone] ?? TONES.info

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl border p-4 ${wrapper} ${className}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${icon}`} />
      <div className="text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  )
}
