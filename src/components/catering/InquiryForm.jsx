import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { EVENT_TYPES, PACKAGES, MENU_CATEGORIES } from '../../data/catering.js'
import { validateInquiry, LIMITS } from '../../lib/validation.js'
import { submitInquiry } from '../../lib/api.js'
import { useSubmitForm } from '../../hooks/useSubmitForm.js'
import { todayISO } from '../../lib/format.js'
import { Field, TextInput, TextArea, Select } from '../ui/Field.jsx'
import Button from '../ui/Button.jsx'
import Alert from '../ui/Alert.jsx'
import { Section, SectionHeading } from '../ui/Section.jsx'
import { BUSINESS } from '../../data/site.js'
import { PhoneIcon, MailIcon, MapPinIcon, ClockIcon } from '../ui/Icons.jsx'

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  eventType: '',
  eventDate: '',
  guestCount: '',
  packageId: '',
  menuInterest: [],
  venue: '',
  budget: '',
  message: '',
  // Honeypot: a field real users never see and never fill. Bots fill every
  // input they find, so a non-empty value here is a strong spam signal. The
  // server rejects those submissions silently.
  website: '',
}

const CONTACT_DETAILS = [
  [PhoneIcon, 'Phone', BUSINESS.phone, `tel:${BUSINESS.phone.replace(/\s/g, '')}`],
  [MailIcon, 'Email', BUSINESS.email, `mailto:${BUSINESS.email}`],
  [MapPinIcon, 'Service area', BUSINESS.address, null],
  [ClockIcon, 'Hours', BUSINESS.hours, null],
]

const MENU_OPTIONS = Object.keys(MENU_CATEGORIES)

const InquiryForm = forwardRef(function InquiryForm(_props, ref) {
  const [values, setValues] = useState(EMPTY)
  const sectionRef = useRef(null)
  const firstFieldRef = useRef(null)

  const { status, errors, formError, handleSubmit, reset } = useSubmitForm({
    validate: validateInquiry,
    submit: submitInquiry,
  })

  // Lets the Packages section pre-select a package and focus this form.
  useImperativeHandle(ref, () => ({
    prefillPackage(pkg) {
      setValues((current) => ({
        ...current,
        packageId: pkg.id,
        guestCount: current.guestCount || String(pkg.minimumGuests ?? ''),
      }))
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.setTimeout(() => firstFieldRef.current?.focus(), 500)
    },
  }))

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function toggleMenuInterest(category) {
    setValues((current) => ({
      ...current,
      menuInterest: current.menuInterest.includes(category)
        ? current.menuInterest.filter((item) => item !== category)
        : [...current.menuInterest, category],
    }))
  }

  function onSubmit(event) {
    event.preventDefault()
    handleSubmit(values)
  }

  function startNewInquiry() {
    setValues(EMPTY)
    reset()
  }

  if (status === 'success') {
    return (
      <Section id="inquire" tone="muted">
        <div className="mx-auto max-w-xl rounded-panel border border-ink-200 bg-white p-10 text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
            ✓
          </span>
          <h2 className="mb-3 text-2xl">Thank you for your inquiry</h2>
          <p className="mb-8 text-ink-500">
            Your request has been sent to our team. We will contact you shortly with availability,
            menu options, and a detailed quote — usually within two business days.
          </p>
          <Button variant="outline" onClick={startNewInquiry}>
            Send another inquiry
          </Button>
        </div>
      </Section>
    )
  }

  const busy = status === 'submitting'

  return (
    <Section id="inquire" tone="muted">
      <div ref={sectionRef}>
        <SectionHeading
          centered
          eyebrow="Request a Quote"
          title="Tell us about your event"
          description="Send us the details and we will reply with availability and an itemised quote. No payment is taken online for catering."
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <aside className="rounded-panel bg-plum-900 p-8 text-white">
          <h3 className="mb-3 font-display text-2xl font-semibold text-white">
            Prefer to talk it through?
          </h3>
          <p className="mb-8 text-white/75">
            Reach us directly and we will walk you through packages, menus, and dates.
          </p>

          <ul className="flex flex-col gap-5">
            {CONTACT_DETAILS.map(([Icon, label, value, href]) => (
              <li key={label} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Icon size={17} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  {href ? (
                    <a href={href} className="text-sm text-white/75 underline-offset-2 hover:underline">
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm text-white/75">{value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <form
          onSubmit={onSubmit}
          noValidate
          className="rounded-panel border border-ink-200 bg-white p-6 sm:p-8"
        >
          {formError && (
            <Alert tone="error" className="mb-6">
              {formError}
            </Alert>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Full name" required error={errors.name}>
              {(fieldProps) => (
                <TextInput
                  {...fieldProps}
                  ref={firstFieldRef}
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

            <Field label="Contact number" required error={errors.phone} hint="e.g. 0917 123 4567">
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

            <Field label="Event type" required error={errors.eventType}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  name="eventType"
                  hasError={Boolean(errors.eventType)}
                  value={values.eventType}
                  onChange={(event) => update('eventType', event.target.value)}
                >
                  <option value="">Select an event type</option>
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Event date" required error={errors.eventDate}>
              {(fieldProps) => (
                <TextInput
                  {...fieldProps}
                  type="date"
                  name="eventDate"
                  min={todayISO()}
                  hasError={Boolean(errors.eventDate)}
                  value={values.eventDate}
                  onChange={(event) => update('eventDate', event.target.value)}
                />
              )}
            </Field>

            <Field label="Estimated guests" required error={errors.guestCount}>
              {(fieldProps) => (
                <TextInput
                  {...fieldProps}
                  type="number"
                  name="guestCount"
                  inputMode="numeric"
                  min={LIMITS.guests.min}
                  max={LIMITS.guests.max}
                  placeholder="e.g. 120"
                  hasError={Boolean(errors.guestCount)}
                  value={values.guestCount}
                  onChange={(event) => update('guestCount', event.target.value)}
                />
              )}
            </Field>

            <Field label="Package of interest" error={errors.packageId}>
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  name="packageId"
                  value={values.packageId}
                  onChange={(event) => update('packageId', event.target.value)}
                >
                  <option value="">Not sure yet / help me choose</option>
                  {PACKAGES.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Venue or location" error={errors.venue}>
              {(fieldProps) => (
                <TextInput
                  {...fieldProps}
                  name="venue"
                  maxLength={LIMITS.name}
                  placeholder="Venue name or city"
                  value={values.venue}
                  onChange={(event) => update('venue', event.target.value)}
                />
              )}
            </Field>
          </div>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-semibold">
              Menu interests <span className="font-normal text-ink-400">(optional)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {MENU_OPTIONS.map((category) => {
                const checked = values.menuInterest.includes(category)
                return (
                  <label
                    key={category}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      checked
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-ink-200 bg-white text-ink-500 hover:border-brand-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggleMenuInterest(category)}
                    />
                    {category}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <Field
            label="Message or special requests"
            error={errors.message}
            className="mt-5"
            hint={`${values.message.length}/${LIMITS.message} characters`}
          >
            {(fieldProps) => (
              <TextArea
                {...fieldProps}
                name="message"
                rows={4}
                maxLength={LIMITS.message}
                placeholder="Dietary restrictions, service style, program timing, or anything else we should know."
                hasError={Boolean(errors.message)}
                value={values.message}
                onChange={(event) => update('message', event.target.value)}
              />
            )}
          </Field>

          {/* Honeypot — hidden from users and assistive tech, visible to bots. */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(event) => update('website', event.target.value)}
            />
          </div>

          <Button type="submit" size="lg" loading={busy} className="mt-6 w-full">
            {busy ? 'Sending inquiry…' : 'Send Inquiry'}
          </Button>

          <p className="mt-3 text-center text-xs text-ink-500">
            We use your details only to respond to this inquiry. No payment is collected on this form.
          </p>
        </form>
      </div>
    </Section>
  )
})

export default InquiryForm
