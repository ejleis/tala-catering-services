import { useState } from 'react'
import { validateBooking, LIMITS } from '../../lib/validation.js'
import { submitBooking } from '../../lib/api.js'
import { useSubmitForm } from '../../hooks/useSubmitForm.js'
import { Field, TextInput, TextArea } from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import Alert from '../ui/Alert.jsx'
import { LockIcon } from '../ui/Icons.jsx'
import { calculateTotals } from './BookingSummary.jsx'
import { formatPeso } from '../../lib/format.js'

/**
 * Only follow a payment URL that is HTTPS on a Maya domain. The URL comes from
 * our own server, but a browser redirect is cheap to constrain, so we do.
 */
function isMayaCheckoutUrl(value) {
  try {
    const url = new URL(value)
    // Local testing only: Vite sets DEV false in production builds, so this
    // exception cannot exist on the live site.
    if (import.meta.env.DEV && url.hostname === 'localhost') return true
    return url.protocol === 'https:' && /(^|\.)(paymaya\.com|maya\.ph)$/.test(url.hostname)
  } catch {
    return false
  }
}

/**
 * Guest details + booking submission.
 *
 * On submit the server stores the booking as PENDING_PAYMENT and returns a
 * Maya hosted-checkout URL; the browser is redirected there to pay. The
 * booking is confirmed only after the server has verified the payment with
 * Maya — arriving back on the site never confirms anything by itself (see
 * PaymentResultPage).
 */
export default function BookingForm({ hotel, room, search }) {
  const [values, setValues] = useState({
    name: '',
    email: '',
    phone: '',
    requests: '',
    website: '', // honeypot
  })
  const [checkoutUrl, setCheckoutUrl] = useState(null)

  const { status, errors, formError, handleSubmit } = useSubmitForm({
    validate: (formValues) =>
      validateBooking({
        ...formValues,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        roomId: room?.id,
      }),
    submit: (formValues, options) =>
      submitBooking(
        {
          ...formValues,
          hotelSlug: hotel.slug,
          roomId: room.id,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          guests: search.guests,
          rooms: search.rooms,
        },
        options,
      ),
    onSuccess: (result) => {
      if (result?.checkoutUrl && isMayaCheckoutUrl(result.checkoutUrl)) {
        setCheckoutUrl(result.checkoutUrl)
        window.location.assign(result.checkoutUrl)
      }
    },
  })

  const { total, nights } = calculateTotals({ room, search })

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  if (status === 'success') {
    return (
      <div className="rounded-panel border border-ink-200 bg-white p-8 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <LockIcon size={26} />
        </span>
        <h2 className="mb-2 text-2xl">Taking you to secure payment…</h2>
        <p className="mx-auto mb-6 max-w-md text-sm text-ink-500">
          You are being sent to Maya to pay. Your booking is confirmed only after your payment is
          received.
        </p>
        {checkoutUrl && (
          <Button href={checkoutUrl}>Continue to Maya</Button>
        )}
      </div>
    )
  }

  const busy = status === 'submitting'
  const canSubmit = Boolean(room) && nights > 0

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        handleSubmit(values)
      }}
      noValidate
      className="rounded-panel border border-ink-200 bg-white p-6 sm:p-8"
    >
      <h2 className="mb-1 font-display text-xl font-semibold">Guest details</h2>
      <p className="mb-6 text-sm text-ink-500">
        Tell us who is staying. You will pay securely on the next step.
      </p>

      {formError && (
        <Alert tone="error" className="mb-6">
          {formError}
        </Alert>
      )}

      {!canSubmit && (
        <Alert tone="info" className="mb-6">
          Choose your dates above and select a room to continue.
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" required error={errors.name}>
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              name="name"
              autoComplete="name"
              maxLength={LIMITS.name}
              hasError={Boolean(errors.name)}
              value={values.name}
              onChange={(event) => update('name', event.target.value)}
            />
          )}
        </Field>

        <Field label="Email address" required error={errors.email}>
          {(fieldProps) => (
            <TextInput
              {...fieldProps}
              type="email"
              name="email"
              autoComplete="email"
              maxLength={LIMITS.email}
              hasError={Boolean(errors.email)}
              value={values.email}
              onChange={(event) => update('email', event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field
        label="Contact number"
        required
        error={errors.phone}
        hint="e.g. 0917 123 4567"
        className="mt-5"
      >
        {(fieldProps) => (
          <TextInput
            {...fieldProps}
            type="tel"
            name="phone"
            autoComplete="tel"
            maxLength={LIMITS.phone}
            hasError={Boolean(errors.phone)}
            value={values.phone}
            onChange={(event) => update('phone', event.target.value)}
          />
        )}
      </Field>

      <Field label="Special requests" error={errors.requests} className="mt-5">
        {(fieldProps) => (
          <TextArea
            {...fieldProps}
            name="requests"
            rows={3}
            maxLength={LIMITS.requests}
            placeholder="Late check-in, high floor, extra bed, accessibility needs…"
            value={values.requests}
            onChange={(event) => update('requests', event.target.value)}
          />
        )}
      </Field>

      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="booking-website">Website</label>
        <input
          id="booking-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(event) => update('website', event.target.value)}
        />
      </div>

      <Alert tone="info" className="mt-6">
        <strong>You will pay on Maya&apos;s secure page.</strong> Your booking is confirmed only
        after your payment is received, and we never see or store your card details.
      </Alert>

      <Button
        type="submit"
        size="lg"
        loading={busy}
        disabled={!canSubmit}
        className="mt-6 w-full"
      >
        <LockIcon size={16} />
        {busy ? 'Preparing payment…' : `Pay with Maya${total ? ` · ${formatPeso(total)}` : ''}`}
      </Button>

      <p className="mt-3 text-center text-xs text-ink-500">
        You will be charged only on Maya&apos;s payment page, and you will receive a confirmation
        email once your payment is received.
      </p>
    </form>
  )
}
