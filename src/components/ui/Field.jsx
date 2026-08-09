import { useId } from 'react'

/**
 * Accessible form field wrapper.
 *
 * Wires up label/input association, error messaging via aria-describedby, and
 * aria-invalid — so screen readers announce validation failures rather than
 * relying on red borders alone.
 */
export function Field({ label, error, hint, required, children, className = '' }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-900">
        {label}
        {required && (
          <span className="ml-0.5 text-brand-600" aria-hidden="true">
            *
          </span>
        )}
        {!required && <span className="ml-1 font-normal text-ink-400">(optional)</span>}
      </label>

      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

const CONTROL_BASE =
  'w-full rounded-lg border bg-ink-50 px-4 py-3 text-sm transition-colors ' +
  'focus:border-brand-500 focus:bg-white focus:outline-none'

export function inputClasses(hasError) {
  return `${CONTROL_BASE} ${hasError ? 'border-red-400 bg-red-50/40' : 'border-ink-200'}`
}

export function TextInput({ hasError, className = '', ...props }) {
  return <input className={`${inputClasses(hasError)} ${className}`} {...props} />
}

export function TextArea({ hasError, className = '', ...props }) {
  return <textarea className={`${inputClasses(hasError)} resize-y ${className}`} {...props} />
}

export function Select({ hasError, className = '', children, ...props }) {
  return (
    <select className={`${inputClasses(hasError)} ${className}`} {...props}>
      {children}
    </select>
  )
}
