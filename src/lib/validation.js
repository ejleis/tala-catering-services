/**
 * Shared validation rules.
 *
 * SECURITY: These run in the browser purely for UX — to give fast feedback.
 * They are NOT a security control. An attacker can skip the UI entirely and
 * POST straight to your API. The server MUST re-run equivalent checks on
 * every request; see server/lib/validation.js, which mirrors this file.
 */

export const LIMITS = {
  name: 100,
  email: 254, // RFC 5321 maximum
  phone: 20,
  message: 2000,
  requests: 1000,
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

export function isFutureDate(value) {
  if (!value) return false
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date >= today
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

export function hasErrors(errors) {
  return Object.keys(errors).length > 0
}
