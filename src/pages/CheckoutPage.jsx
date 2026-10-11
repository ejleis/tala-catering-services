import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PACKAGES } from '../data/catering.js'
import { formatPeso, todayISO } from '../lib/format.js'
import { LIMITS, hasErrors, validateCheckout } from '../lib/validation.js'
import { Container } from '../components/ui/Section.jsx'
import { Field, TextInput } from '../components/ui/Field.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'

const INITIAL = { name: '', email: '', phone: '', eventDate: '', venue: '' }

/**
 * Catering checkout.
 *
 * The router state only carries { packageId, guests, days }. The package and
 * its rate are looked up again from PACKAGES here, and guests/days are
 * re-validated, so nothing displayed on this page depends on a price someone
 * could have placed in history state. The server must do the same lookup
 * and never accept a price from the browser.
 *
 * Paying is intentionally disabled until the Maya catering payment endpoint
 * exists: there is nothing safe to submit to yet.
 */
export default function CheckoutPage() {
  const { state } = useLocation()
  const [values, setValues] = useState(INITIAL)
  const [errors, setErrors] = useState({})

  const pkg = PACKAGES.find((item) => item.id === state?.packageId && item.pricePerGuest != null)
  const guests = Number(state?.guests)
  const days = Number(state?.days)
  const validOrder =
    pkg &&
    Number.isInteger(guests) &&
    guests >= (pkg.minimumGuests ?? 1) &&
    guests <= LIMITS.guests.max &&
    Number.isInteger(days) &&
    days >= 1 &&
    days <= 30

  if (!validOrder) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="mb-3 font-display text-2xl font-semibold">Nothing to check out yet</h1>
          <p className="mb-6 text-ink-600">
            Choose Kasalo or Handaan and estimate your total first, then continue to checkout.
          </p>
          <Button to="/#packages">Back to packages</Button>
        </div>
      </Container>
    )
  }

  const total = pkg.pricePerGuest * guests * days

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validateCheckout(values)
    setErrors(nextErrors)
    // Payment is not wired up yet, so a valid form still stops here.
    if (hasErrors(nextErrors)) return
  }

  return (
    <Container className="py-12 md:py-16">
      <Link to="/#packages" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to packages
      </Link>
      <h1 className="mb-8 mt-4 font-display text-3xl font-semibold">Checkout</h1>

      <div className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={handleSubmit} noValidate className="rounded-panel border border-ink-200 bg-white p-6 md:p-8">
          <h2 className="mb-5 font-display text-xl font-semibold">Your details</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name} className="sm:col-span-2">
              {(props) => (
                <TextInput {...props} name="name" autoComplete="name" maxLength={LIMITS.name}
                  value={values.name} onChange={handleChange} hasError={!!errors.name} />
              )}
            </Field>
            <Field label="Email" required error={errors.email}>
              {(props) => (
                <TextInput {...props} type="email" name="email" autoComplete="email" maxLength={LIMITS.email}
                  value={values.email} onChange={handleChange} hasError={!!errors.email} />
              )}
            </Field>
            <Field label="Contact number" required error={errors.phone}>
              {(props) => (
                <TextInput {...props} type="tel" name="phone" autoComplete="tel" maxLength={LIMITS.phone}
                  value={values.phone} onChange={handleChange} hasError={!!errors.phone} />
              )}
            </Field>
            <Field label="Event date" required error={errors.eventDate}>
              {(props) => (
                <TextInput {...props} type="date" name="eventDate" min={todayISO()}
                  value={values.eventDate} onChange={handleChange} hasError={!!errors.eventDate} />
              )}
            </Field>
            <Field label="Venue / delivery address" required error={errors.venue}>
              {(props) => (
                <TextInput {...props} name="venue" maxLength={LIMITS.venue}
                  value={values.venue} onChange={handleChange} hasError={!!errors.venue} />
              )}
            </Field>
          </div>

          <Alert tone="info" className="mt-6">
            Online payment for catering packages is not active yet. To book now, please{' '}
            <Link to="/#inquire" className="font-semibold underline">send an inquiry</Link>{' '}
            and we will reply with a firm quote.
          </Alert>

          <Button type="submit" className="mt-6 w-full" disabled>
            Pay with Maya
          </Button>
        </form>

        <aside className="rounded-panel border border-ink-200 bg-ink-50 p-6 md:p-8" aria-label="Order summary">
          <h2 className="mb-5 font-display text-xl font-semibold">Order summary</h2>
          <p className="font-display text-lg font-semibold">{pkg.name}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Rate</dt>
              <dd>{formatPeso(pkg.pricePerGuest)} / guest</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Guests</dt>
              <dd>{guests}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-500">Days</dt>
              <dd>{days}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-ink-200 pt-5">
            <p className="text-xs text-ink-500">
              {formatPeso(pkg.pricePerGuest)} × {guests} guests × {days} {days === 1 ? 'day' : 'days'}
            </p>
            <p className="font-display text-3xl font-semibold text-brand-700">{formatPeso(total)}</p>
          </div>
        </aside>
      </div>
    </Container>
  )
}
