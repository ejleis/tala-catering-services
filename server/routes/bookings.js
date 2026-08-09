const express = require('express')
const crypto = require('node:crypto')
const rateLimit = require('express-rate-limit')
const { validateBooking } = require('../lib/validation')
const { sendBookingToOwner } = require('../lib/mailer')

const router = express.Router()

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many booking requests. Please try again later.' },
})

/**
 * Server-side catalogue.
 *
 * CRITICAL: prices live here, never in the request body. If the client sent the
 * price, a user could edit it in devtools and book a suite for ₱1. The server
 * looks up the rate by roomId and computes the total itself.
 *
 * Replace this with a database query in production.
 */
const CATALOGUE = {
  'swiss-belhotel-blulane': {
    name: 'Swiss-Belhotel Blulane',
    rooms: {
      'sbb-deluxe': { name: 'Deluxe Room', rate: 4500, maxGuests: 2 },
      'sbb-premier': { name: 'Premier Room', rate: 5800, maxGuests: 2 },
      'sbb-suite': { name: 'Executive Suite', rate: 8200, maxGuests: 3 },
    },
  },
  'bay-area-suites-manila': {
    name: 'Bay Area Suites Manila',
    rooms: {
      'bas-studio': { name: 'Studio Suite', rate: 3900, maxGuests: 2 },
      'bas-family': { name: 'Family Suite', rate: 6600, maxGuests: 4 },
      'bas-penthouse': { name: 'Penthouse Suite', rate: 9800, maxGuests: 3 },
    },
  },
  'red-hotel-cubao': {
    name: 'Red Hotel Cubao',
    rooms: {
      'rhc-standard': { name: 'Standard Room', rate: 2400, maxGuests: 2 },
      'rhc-deluxe': { name: 'Deluxe Room', rate: 3100, maxGuests: 2 },
      'rhc-triple': { name: 'Triple Room', rate: 3900, maxGuests: 3 },
    },
  },
}

const TAX_RATE = 0.12

function buildReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  // crypto.randomInt is unpredictable; Math.random is not and must never be
  // used for anything a user could try to guess or enumerate.
  const suffix = crypto.randomInt(0, 10_000).toString().padStart(4, '0')
  return `HB-${date}-${suffix}`
}

router.post('/', submitLimiter, async (req, res, next) => {
  try {
    if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
      return res.status(200).json({ ok: true })
    }

    const { data, errors } = validateBooking(req.body)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }

    // Verify the hotel and room actually exist, server-side.
    const hotel = CATALOGUE[data.hotelSlug]
    if (!hotel) {
      return res.status(400).json({ message: 'Unknown hotel.', errors: { hotelSlug: 'Unknown hotel.' } })
    }
    const room = hotel.rooms[data.roomId]
    if (!room) {
      return res.status(400).json({ message: 'Unknown room.', errors: { roomId: 'Unknown room.' } })
    }

    // Enforce occupancy server-side too — the UI filter is not a guarantee.
    if (data.guests > room.maxGuests * data.rooms) {
      return res.status(400).json({
        message: 'That room cannot accommodate this many guests.',
        errors: { roomId: 'Too many guests for this room type.' },
      })
    }

    const nights = Math.round(
      (new Date(`${data.checkOut}T00:00:00Z`) - new Date(`${data.checkIn}T00:00:00Z`)) / 86_400_000,
    )

    // Cap stay length — guards against absurd totals from date manipulation.
    if (nights < 1 || nights > 30) {
      return res.status(400).json({
        message: 'Stays must be between 1 and 30 nights.',
        errors: { checkOut: 'Please choose a stay of 1–30 nights.' },
      })
    }

    const subtotal = room.rate * nights * data.rooms
    const total = subtotal + Math.round(subtotal * TAX_RATE)
    const reference = buildReference()

    // TODO (when Maya is live):
    //   1. Persist the booking with status PENDING_PAYMENT and this reference.
    //   2. Call Maya's Checkout API server-side with MAYA_SECRET_KEY to create
    //      a checkout session for `total`.
    //   3. Return { reference, checkoutUrl } and let the frontend redirect.
    //   4. Mark the booking PAID only from the verified webhook below — never
    //      because the browser reached a success URL.

    await sendBookingToOwner(
      {
        ...data,
        hotelName: hotel.name,
        roomName: room.name,
        nights,
        total: `PHP ${total.toLocaleString()}`,
      },
      reference,
    )

    return res.status(201).json({ ok: true, reference, status: 'PENDING_PAYMENT' })
  } catch (error) {
    return next(error)
  }
})

/**
 * Maya webhook — payment verification endpoint (stub).
 *
 * Note this route needs the RAW body to verify the signature, so mount it with
 * express.raw() before the global express.json() parser in a real deployment.
 * Verifying with a parsed-and-re-stringified body will produce a different byte
 * sequence and the signature check will fail (or worse, be skipped).
 */
router.post('/maya/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.get('Maya-Signature') // confirm the real header name in Maya's docs
  const secret = process.env.MAYA_WEBHOOK_SECRET

  if (!secret || !signature) return res.status(400).end()

  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex')

  // timingSafeEqual prevents a timing side channel that could let an attacker
  // discover a valid signature byte by byte.
  const signatureBuffer = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return res.status(401).end()
  }

  // const event = JSON.parse(req.body.toString('utf8'))
  // Idempotency: ignore an event id already processed — providers retry, and
  // double-processing would double-confirm or double-email.
  // Then: mark booking PAID/CONFIRMED, store the Maya transaction id, and
  // queue the confirmation emails (retryable — never fail the payment because
  // an email bounced).

  return res.status(200).json({ received: true })
})

module.exports = router
