/**
 * SERVER-SIDE validation — the authoritative copy.
 *
 * This deliberately mirrors src/lib/validation.js. The browser copy exists for
 * fast feedback; THIS one is the security control, because an attacker can
 * POST directly to the API and never load the frontend at all.
 */

const LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  message: 2000,
  requests: 1000,
  guests: { min: 1, max: 2000 },
  rooms: { min: 1, max: 10 },
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PH_PHONE_PATTERN = /^(\+?63|0)[\d\s-]{9,15}$/

/**
 * Coerces unknown input to a bounded, trimmed string.
 * Anything that is not a string becomes '' rather than throwing — this stops
 * type-confusion attacks (e.g. sending an object or array where a string is
 * expected, a common NoSQL-injection vector).
 */
function str(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function int(value, { min, max }) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  if (parsed < min || parsed > max) return null
  return parsed
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())
}

function isFutureDate(value) {
  if (!isValidDate(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return date >= today
}

/**
 * Neutralises the leading characters spreadsheet software treats as a formula.
 * Relevant because owners often paste inquiry data into Excel/Sheets, where a
 * value beginning with =, +, -, or @ can execute (CSV injection).
 */
function deFormula(value) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function validateInquiry(body) {
  const errors = {}

  const data = {
    name: str(body?.name, LIMITS.name),
    email: str(body?.email, LIMITS.email).toLowerCase(),
    phone: str(body?.phone, LIMITS.phone),
    eventType: str(body?.eventType, 50),
    eventDate: str(body?.eventDate, 10),
    guestCount: int(body?.guestCount, LIMITS.guests),
    packageId: str(body?.packageId, 50),
    venue: str(body?.venue, LIMITS.name),
    message: str(body?.message, LIMITS.message),
    menuInterest: Array.isArray(body?.menuInterest)
      ? body.menuInterest.slice(0, 10).map((item) => str(item, 50)).filter(Boolean)
      : [],
  }

  if (!data.name) errors.name = 'Please enter your full name.'
  if (!data.email) errors.email = 'Please enter your email address.'
  else if (!EMAIL_PATTERN.test(data.email)) errors.email = 'Please enter a valid email address.'
  if (!data.phone) errors.phone = 'Please enter a contact number.'
  else if (!PH_PHONE_PATTERN.test(data.phone)) errors.phone = 'Please enter a valid contact number.'
  if (!data.eventType) errors.eventType = 'Please choose an event type.'
  if (!data.eventDate) errors.eventDate = 'Please choose your event date.'
  else if (!isFutureDate(data.eventDate)) errors.eventDate = 'Please choose a future date.'
  if (data.guestCount === null) errors.guestCount = 'Please enter a valid guest count.'

  return { data, errors }
}

function validateBooking(body) {
  const errors = {}

  const data = {
    name: str(body?.name, LIMITS.name),
    email: str(body?.email, LIMITS.email).toLowerCase(),
    phone: str(body?.phone, LIMITS.phone),
    requests: str(body?.requests, LIMITS.requests),
    hotelSlug: str(body?.hotelSlug, 80),
    roomId: str(body?.roomId, 80),
    checkIn: str(body?.checkIn, 10),
    checkOut: str(body?.checkOut, 10),
    guests: int(body?.guests, LIMITS.guests),
    rooms: int(body?.rooms, LIMITS.rooms),
  }

  if (!data.name) errors.name = 'Please enter the guest name.'
  if (!data.email) errors.email = 'Please enter an email address.'
  else if (!EMAIL_PATTERN.test(data.email)) errors.email = 'Please enter a valid email address.'
  if (!data.phone) errors.phone = 'Please enter a contact number.'
  else if (!PH_PHONE_PATTERN.test(data.phone)) errors.phone = 'Please enter a valid contact number.'
  if (!data.hotelSlug) errors.hotelSlug = 'Missing hotel.'
  if (!data.roomId) errors.roomId = 'Please select a room.'
  if (!isFutureDate(data.checkIn)) errors.checkIn = 'Check-in must be today or later.'
  if (!isValidDate(data.checkOut) || data.checkOut <= data.checkIn)
    errors.checkOut = 'Check-out must be after check-in.'
  if (data.guests === null) errors.guests = 'Invalid guest count.'
  if (data.rooms === null) errors.rooms = 'Invalid room count.'

  return { data, errors }
}

module.exports = { validateInquiry, validateBooking, deFormula, LIMITS }
