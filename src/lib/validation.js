/**
 * Shared validation rules.
 *
 * SECURITY: These run in the browser purely for UX — to give fast feedback.
 * They are NOT a security control. An attacker can skip the UI entirely and
 * POST straight to your API. The server MUST re-run equivalent checks on
 * every request; see server/lib/validation.js, which mirrors this file.
 */

import { MIN_ONLINE_PAYMENT_PESOS } from '../data/catering.js'
import { todayISO } from './format.js'

export const LIMITS = {
  name: 100,
  email: 254, // RFC 5321 maximum
  phone: 20,
  message: 2000,
  requests: 1000,
  venue: 200,
  guests: { min: 1, max: 2000 },
  rooms: { min: 1, max: 10 },
}

// Deliberately permissive: over-strict email regexes reject valid addresses.
// Real verification happens by sending mail, not by pattern matching.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Philippine mobile/landline formats, tolerant of spaces, dashes, and +63.
const PH_PHONE_PATTERN = /^(\+?63|0)[\d\s-]{9,15}$/

export function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function isValidEmail(value) {
  return (
    typeof value === 'string' &&
    value.length <= LIMITS.email &&
    EMAIL_PATTERN.test(value.trim())
  )
}

export function isValidPhone(value) {
  return (
    typeof value === 'string' &&
    PH_PHONE_PATTERN.test(value.replace(/\s+/g, ' ').trim())
  )
}

/** True for a real YYYY-MM-DD date that is today or later in Manila (same rule as the server). */
export function isFutureDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false // e.g. 2027-02-30
  return value >= todayISO()
}

/** Validates the catering inquiry form. Returns a field -> message map. */
export function validateInquiry(values) {
  const errors = {}

  if (!isNonEmpty(values.name)) errors.name = 'Please enter your full name.'
  else if (values.name.length > LIMITS.name) errors.name = 'Name is too long.'

  if (!isNonEmpty(values.email)) errors.email = 'Please enter your email address.'
  else if (!isValidEmail(values.email)) errors.email = 'Please enter a valid email address.'

  if (!isNonEmpty(values.phone)) errors.phone = 'Please enter a contact number.'
  else if (!isValidPhone(values.phone))
    errors.phone = 'Enter a valid PH number, e.g. 0917 123 4567.'

  if (!isNonEmpty(values.eventType)) errors.eventType = 'Please choose an event type.'

  if (!isNonEmpty(values.eventDate)) errors.eventDate = 'Please choose your event date.'
  else if (!isFutureDate(values.eventDate)) errors.eventDate = 'Please choose a future date.'

  const guests = Number(values.guestCount)
  if (!values.guestCount) errors.guestCount = 'Please enter an estimated guest count.'
  else if (!Number.isFinite(guests) || guests < LIMITS.guests.min || guests > LIMITS.guests.max)
    errors.guestCount = `Enter a number between ${LIMITS.guests.min} and ${LIMITS.guests.max}.`

  if (values.message && values.message.length > LIMITS.message)
    errors.message = 'Message is too long.'

  return errors
}

/** Validates the hotel booking form. Returns a field -> message map. */
export function validateBooking(values) {
  const errors = {}

  if (!isNonEmpty(values.name)) errors.name = 'Please enter the guest name.'
  if (!isNonEmpty(values.email)) errors.email = 'Please enter an email address.'
  else if (!isValidEmail(values.email)) errors.email = 'Please enter a valid email address.'

  if (!isNonEmpty(values.phone)) errors.phone = 'Please enter a contact number.'
  else if (!isValidPhone(values.phone))
    errors.phone = 'Enter a valid PH number, e.g. 0917 123 4567.'

  if (!isNonEmpty(values.checkIn)) errors.checkIn = 'Choose a check-in date.'
  else if (!isFutureDate(values.checkIn)) errors.checkIn = 'Check-in cannot be in the past.'

  if (!isNonEmpty(values.checkOut)) errors.checkOut = 'Choose a check-out date.'
  else if (values.checkIn && new Date(values.checkOut) <= new Date(values.checkIn))
    errors.checkOut = 'Check-out must be after check-in.'

  if (!values.roomId) errors.roomId = 'Please select a room.'

  return errors
}

/** Validates the catering checkout details form. Returns a field -> message map. */
export function validateCheckout(values) {
  const errors = {}

  if (!isNonEmpty(values.name)) errors.name = 'Please enter your full name.'
  else if (values.name.length > LIMITS.name) errors.name = 'Name is too long.'

  if (!isNonEmpty(values.email)) errors.email = 'Please enter your email address.'
  else if (!isValidEmail(values.email)) errors.email = 'Please enter a valid email address.'

  if (!isNonEmpty(values.phone)) errors.phone = 'Please enter a contact number.'
  else if (!isValidPhone(values.phone))
    errors.phone = 'Enter a valid PH number, e.g. 0917 123 4567.'

  if (!isNonEmpty(values.eventDate)) errors.eventDate = 'Please choose your event date.'
  else if (!isFutureDate(values.eventDate)) errors.eventDate = 'Please choose a future date.'

  if (!isNonEmpty(values.venue)) errors.venue = 'Please enter the event venue or delivery address.'
  else if (values.venue.length > LIMITS.venue) errors.venue = 'Venue is too long.'

  return errors
}

const AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/

/**
 * Converts a typed peso string such as "5000.5" to whole centavos (500050)
 * using string maths only, or returns null when it is not a valid amount.
 */
export function pesosToCentavos(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!AMOUNT_PATTERN.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

const pesoText = (centavos) =>
  `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Validates the catering payment choice. `amount` is the typed peso string,
 * `total` the order total in pesos (display only; the server decides).
 * Returns { amountPesos? }. UX only; the server re-checks everything.
 */
export function validatePaymentAmount(option, amount, total) {
  const errors = {}
  if (option !== 'custom') return errors

  const text = typeof amount === 'string' ? amount.trim() : ''
  if (!text) {
    errors.amountPesos = 'Please enter the amount you wish to pay now.'
    return errors
  }
  const centavos = pesosToCentavos(text)
  if (centavos === null) {
    errors.amountPesos = 'Please enter a valid amount, e.g. 5000 or 5000.50.'
    return errors
  }
  const minCentavos = Math.round(MIN_ONLINE_PAYMENT_PESOS * 100)
  const totalCentavos = Math.round(Number(total) * 100)
  if (centavos < minCentavos) {
    errors.amountPesos = `Please enter an amount of at least ${pesoText(minCentavos)}.`
  } else if (centavos > totalCentavos) {
    errors.amountPesos = `The amount cannot be more than the order total of ${pesoText(totalCentavos)}.`
  }
  return errors
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0
}
