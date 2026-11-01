import { Link } from 'react-router-dom'

/** One-line notice shown beside a form's submit button. */
export default function PrivacyNote({ className = '' }) {
  return (
    <p className={`mt-3 text-center text-xs text-ink-500 ${className}`}>
      By submitting this form, you agree to the processing of your personal information as
      described in our{' '}
      <Link to="/privacy" className="font-semibold text-brand-700 underline hover:text-brand-800">
        Privacy Notice
      </Link>
      .
    </p>
  )
}
