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
  days: { min: 1, max: 30 },
  venue: 200,
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

/**
 * Strict whole-number parsing: a JS integer, or a string of digits only
 * (surrounding whitespace allowed). Arrays, "60abc", "1.9e5", "1.5", "-3" -> null.
 */
function int(value, { min, max }) {
  let parsed
  if (typeof value === 'number') parsed = value
  else if (typeof value === 'string' && /^\d+$/.test(value.trim())) parsed = Number(value.trim())
  else return null
  if (!Number.isInteger(parsed) || !Number.isSafeInteger(parsed)) return null
  if (parsed < min || parsed > max) return null
  return parsed
}

/** A real calendar date in YYYY-MM-DD form (rejects 2027-02-30 by round-tripping). */
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Today's calendar date in Asia/Manila (the business's day), as YYYY-MM-DD. */
function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Today or later by the Manila calendar. ISO dates compare correctly as strings. */
function isFutureDate(value, now = new Date()) {
  if (!isValidDate(value)) return false
  return value >= manilaToday(now)
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

const PESO_AMOUNT = /^\d{1,9}(\.\d{1,2})?$/

/** Strict "1234" / "1234.5" / "1234.50" -> whole centavos (string maths, no floats). Anything else -> null. */
function pesosToCentavos(value) {
  if (typeof value !== 'string' || !PESO_AMOUNT.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

/** Catering order: only the package id, guest/day counts and contact details are accepted — never a price. */
function validateCateringOrder(body) {
  const errors = {}

  // Payment option: missing/empty means 'full' (backward compatible). Range checks live in the route.
  const rawOption = body?.paymentOption
  let paymentOption = null
  if (rawOption === undefined || rawOption === null || rawOption === '') paymentOption = 'full'
  else if (rawOption === 'full' || rawOption === 'custom') paymentOption = rawOption
  const rawAmount = body?.amountPesos
  const amountPesos =
    typeof rawAmount === 'string' || typeof rawAmount === 'number' ? String(rawAmount).trim().slice(0, 20) : ''

  const data = {
    name: str(body?.name, LIMITS.name),
    email: str(body?.email, LIMITS.email).toLowerCase(),
    phone: str(body?.phone, LIMITS.phone),
    eventDate: str(body?.eventDate, 10),
    venue: str(body?.venue, LIMITS.venue),
    packageId: str(body?.packageId, 50),
    guests: int(body?.guests, LIMITS.guests),
    days: int(body?.days, LIMITS.days),
    paymentOption,
    amountPesos,
  }

  if (paymentOption === null) errors.paymentOption = 'Please choose a valid payment option.'
  else if (paymentOption === 'custom' && pesosToCentavos(amountPesos) === null) {
    errors.amountPesos = 'Please enter a valid amount in pesos, with up to two decimal places.'
  }

  if (!data.name) errors.name = 'Please enter your full name.'
  if (!data.email) errors.email = 'Please enter your email address.'
  else if (!EMAIL_PATTERN.test(data.email)) errors.email = 'Please enter a valid email address.'
  if (!data.phone) errors.phone = 'Please enter a contact number.'
  else if (!PH_PHONE_PATTERN.test(data.phone)) errors.phone = 'Please enter a valid contact number.'
  if (!data.eventDate) errors.eventDate = 'Please choose your event date.'
  else if (!isFutureDate(data.eventDate)) errors.eventDate = 'Please choose a future date.'
  if (!data.venue) errors.venue = 'Please enter the event venue or delivery address.'
  if (!data.packageId) errors.packageId = 'Please choose a package.'
  if (data.guests === null) errors.guests = 'Invalid guest count.'
  if (data.days === null) errors.days = 'Invalid number of days.'

  return { data, errors }
}

module.exports = { isValidDate, isFutureDate, manilaToday, int, validateInquiry, validateBooking, validateCateringOrder, pesosToCentavos, deFormula, LIMITS }
