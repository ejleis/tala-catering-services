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
 * Guest details + booking submission.
 *
 * PAYMENT STATUS: Maya is not yet connected (pending the client's Maya
 * Business account). Until then the server records the booking as
 * PENDING_PAYMENT and emails the owner, and this form says so plainly rather
 * than implying a confirmed reservation.
 *
 * When Maya goes live, the server will return a `checkoutUrl` from this same
 * endpoint and the only change needed here is the redirect in `onSuccess`.
 */
export default function BookingForm({ hotel, room, search }) {
  const [values, setValues] = useState({
    name: '',
    email: '',
    phone: '',
    requests: '',
    website: '', // honeypot
  })
  const [reference, setReference] = useState(null)

  const { status, errors, formError, handleSubmit, reset } = useSubmitForm({
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
      // Once Maya is live the server returns a hosted checkout URL:
      // if (result?.checkoutUrl) { window.location.assign(result.checkoutUrl); return }
      setReference(result?.reference ?? null)
    },
  })

  const { total, nights } = calculateTotals({ room, search })

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  if (status === 'success') {
    return (
      <div className="rounded-panel border border-ink-200 bg-white p-8 text-center">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
          ✓
        </span>
        <h2 className="mb-2 text-2xl">Booking request received</h2>
        {reference && (
          <p className="mb-3 font-display text-lg font-semibold">Reference: {reference}</p>
        )}
        <p className="mx-auto mb-6 max-w-md text-sm text-ink-500">
          We have sent your request to our team and emailed you a copy. Your room is not yet
          confirmed — we will contact you shortly to arrange payment and confirm availability with
          the property.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setValues({ name: '', email: '', phone: '', requests: '', website: '' })
            setReference(null)
            reset()
          }}
        >
          Make another booking
        </Button>
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
        Tell us who is staying so we can hold the room while we confirm availability.
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
        <strong>Online payment is not active yet.</strong> Maya checkout will be enabled once the
        business Maya account is verified. For now we will confirm your booking and arrange payment
        with you directly.
      </Alert>

      <Button
        type="submit"
        size="lg"
        loading={busy}
        disabled={!canSubmit}
        className="mt-6 w-full"
      >
        <LockIcon size={16} />
        {busy ? 'Sending request…' : `Request Booking${total ? ` · ${formatPeso(total)}` : ''}`}
      </Button>

      <p className="mt-3 text-center text-xs text-ink-500">
        Submitting does not charge you. You will receive an email copy of this request.
      </p>
    </form>
  )
}
