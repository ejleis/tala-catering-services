import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { submitCateringOrder } from '../lib/api.js'
import { isMayaCheckoutUrl } from '../lib/maya.js'
import { useSubmitForm } from '../hooks/useSubmitForm.js'
import { LockIcon } from '../components/ui/Icons.jsx'
import { PACKAGES } from '../data/catering.js'
import { formatPeso, todayISO } from '../lib/format.js'
import { LIMITS, validateCheckout } from '../lib/validation.js'
import { Container } from '../components/ui/Section.jsx'
import { Field, TextInput } from '../components/ui/Field.jsx'
import Alert from '../components/ui/Alert.jsx'
import Button from '../components/ui/Button.jsx'

const INITIAL = { name: '', email: '', phone: '', eventDate: '', venue: '', website: '' } // website = honeypot

/**
 * Catering checkout.
 *
 * The router state only carries { packageId, guests, days }. The package and
 * its rate are looked up again from PACKAGES here, and guests/days are
 * re-validated, so nothing displayed on this page depends on a price someone
 * could have placed in history state. The server must do the same lookup
 * and never accept a price from the browser.
 *
 * Submitting sends only { packageId, guests, days } plus the contact details;
 * the server prices the order from its own catalogue, stores it as
 * PENDING_PAYMENT and returns a Maya checkout URL. The order is confirmed only
 * after the server has verified the payment with Maya.
 */
export default function CheckoutPage() {
  const { state } = useLocation()
  const [values, setValues] = useState(INITIAL)
  const [checkoutUrl, setCheckoutUrl] = useState(null)

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

  const { status, errors, formError, handleSubmit: submitForm, setErrors } = useSubmitForm({
    validate: validateCheckout,
    submit: (formValues, options) =>
      submitCateringOrder({ ...formValues, packageId: pkg?.id, guests, days }, options),
    onSuccess: (result) => {
      if (result?.checkoutUrl && isMayaCheckoutUrl(result.checkoutUrl)) {
        setCheckoutUrl(result.checkoutUrl)
        window.location.assign(result.checkoutUrl)
      }
    },
  })

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
    submitForm(values)
  }

  const busy = status === 'submitting'

  if (status === 'success') {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-lg rounded-panel border border-ink-200 bg-white p-8 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <LockIcon size={26} />
          </span>
          <h1 className="mb-2 font-display text-2xl font-semibold">Taking you to secure payment…</h1>
          <p className="mx-auto mb-6 max-w-md text-sm text-ink-500">
            You are being sent to Maya to pay. Your order is confirmed only after your payment is received.
          </p>
          {checkoutUrl && <Button href={checkoutUrl}>Continue to Maya</Button>}
        </div>
      </Container>
    )
  }

  // Rendered twice (inside the form on desktop, below the summary on mobile);
  // only one copy is ever visible. The button submits the form by id.
  const payBlock = (
    <>
      {formError && (
        <Alert tone="error" className="mt-6">
          {formError}
        </Alert>
      )}

      <Alert tone="info" className="mt-6">
        <strong>You will pay on Maya&apos;s secure page.</strong> Your order is confirmed only after
        your payment is received, and we never see or store your card details.
      </Alert>

      <Button type="submit" form="checkout-form" size="lg" loading={busy} className="mt-6 w-full">
        <LockIcon size={16} />
        {busy ? 'Preparing payment…' : `Pay with Maya · ${formatPeso(total)}`}
      </Button>

      {/* [NEEDS PROOF] Placeholder wording — the client must approve their real cancellation and refund policy before launch. */}
      <p className="mt-3 text-center text-xs text-ink-500">
        For changes or cancellations after payment, please contact us directly. Any refund is
        handled by Tala&apos;s Event Catering Services in line with their policy.
      </p>
    </>
  )

  return (
    <Container className="py-12 md:py-16">
      <Link to="/#packages" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Back to packages
      </Link>
      <h1 className="mb-8 mt-4 font-display text-3xl font-semibold">Checkout</h1>

      <div className="grid items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
        <form id="checkout-form" onSubmit={handleSubmit} noValidate className="rounded-panel border border-ink-200 bg-white p-6 md:p-8">
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

          {/* Honeypot */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="checkout-website">Website</label>
            <input id="checkout-website" name="website" type="text" tabIndex={-1} autoComplete="off"
              value={values.website} onChange={handleChange} />
          </div>

          {/* Desktop: payment block stays at the bottom of the form card. */}
          <div className="hidden lg:block">{payBlock}</div>
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

        {/* Mobile: the order summary comes first, then the payment block below it. */}
        <div className="lg:hidden">{payBlock}</div>
      </div>
    </Container>
  )
}
