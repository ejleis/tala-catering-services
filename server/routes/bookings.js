const express = require('express');
const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { validateBooking } = require('../lib/validation');
const db = require('../lib/db');
const maya = require('../lib/maya');
const payments = require('../lib/payments');
const { getClientIp } = require('../lib/clientIp');
const { testPesos } = require('../lib/testItem');

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: 'Too many booking requests. Please try again later.' },
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: 'Too many requests. Please slow down.' },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      'sbb-suite': { name: 'Executive One-Bedroom Suite', rate: 8000, maxGuests: 3 },
    },
  },
  'bay-area-suites-manila': {
    name: 'Bay Area Suites Manila',
    rooms: {
      'basm-suite': { name: 'Superior One Bedroom Suite', rate: 5238, maxGuests: 3 },
    },
  },
  'red-hotel-cubao': {
    name: 'Red Hotel Cubao',
    rooms: {
      'rhc-suite': { name: 'Executive Suite', rate: 6533, maxGuests: 3 },
    },
  },
};

/** The real price list, plus the hidden test room while ALLOW_TEST_ITEM is on (see lib/testItem.js). */
function getCatalogue() {
  const pesos = testPesos();
  if (pesos === null) return CATALOGUE;
  return {
    ...CATALOGUE,
    'test-hotel': {
      name: 'Test Hotel (internal)',
      rooms: { 'test-room': { name: 'Test Room (internal)', rate: pesos, maxGuests: 3 } },
    },
  };
}

function buildReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // crypto.randomInt is unpredictable; Math.random is not and must never be
  // used for anything a user could try to guess or enumerate. (The reference
  // is a human-friendly label only — the booking id is the unguessable UUID.)
  const suffix = crypto.randomInt(0, 10_000).toString().padStart(4, '0');
  return `HB-${date}-${suffix}`;
}

// [NEEDS PROOF] The 12% figure is a placeholder until the client confirms the
// real tax treatment (is VAT already included in the hotels' rates?). Override
// without a code change by setting TAX_RATE (e.g. 0 or 0.12) on the server.
function taxRate() {
  const value = Number.parseFloat(process.env.TAX_RATE ?? '0.12');
  return Number.isFinite(value) && value >= 0 && value <= 0.3 ? value : 0.12;
}

async function insertBooking(client, row) {
  // Reference collisions are very unlikely but cheap to handle: retry.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await client.query(
        `insert into bookings
           (reference, hotel_slug, room_id, hotel_name, room_name, guest_name, guest_email, guest_phone,
            special_requests, check_in, check_out, nights, guests, rooms,
            rate_centavos, subtotal_centavos, tax_centavos, total_centavos, expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now() + interval '60 minutes')
         returning id, reference`,
        [buildReference(), ...row],
      );
      return rows[0];
    } catch (error) {
      if (error.code !== '23505' || attempt === 4) throw error;
    }
  }
  return null;
}

router.post('/', submitLimiter, async (req, res, next) => {
  try {
    if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
      return res.status(200).json({ ok: true });
    }

    // Safety switch: with no Maya keys / environment / database we refuse to
    // take bookings rather than silently accept ones that can never be paid.
    if (!maya.isEnabled() || !process.env.DATABASE_URL) {
      return res.status(503).json({ message: 'Online booking is temporarily unavailable. Please contact us directly.' });
    }

    const { data, errors } = validateBooking(req.body);
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors });
    }

    // Verify the hotel and room actually exist, server-side.
    const catalogue = getCatalogue();
    const hotel = Object.hasOwn(catalogue, data.hotelSlug) ? catalogue[data.hotelSlug] : null;
    if (!hotel) {
      return res.status(400).json({ message: 'Unknown hotel.', errors: { hotelSlug: 'Unknown hotel.' } });
    }
    const room = Object.hasOwn(hotel.rooms, data.roomId) ? hotel.rooms[data.roomId] : null;
    if (!room) {
      return res.status(400).json({ message: 'Unknown room.', errors: { roomId: 'Unknown room.' } });
    }

    // Enforce occupancy server-side too — the UI filter is not a guarantee.
    if (data.guests > room.maxGuests * data.rooms) {
      return res.status(400).json({
        message: 'That room cannot accommodate this many guests.',
        errors: { roomId: 'Too many guests for this room type.' },
      });
    }

    const nights = Math.round((new Date(`${data.checkOut}T00:00:00Z`) - new Date(`${data.checkIn}T00:00:00Z`)) / 86_400_000);

    // Cap stay length — guards against absurd totals from date manipulation.
    if (nights < 1 || nights > 30) {
      return res.status(400).json({
        message: 'Stays must be between 1 and 30 nights.',
        errors: { checkOut: 'Please choose a stay of 1–30 nights.' },
      });
    }

    // All money is whole centavos from here on; the browser's numbers are never used.
    const rateCentavos = Math.round(room.rate * 100);
    const subtotal = rateCentavos * nights * data.rooms;
    const tax = Math.round(subtotal * taxRate());
    const total = subtotal + tax;

    const booking = await db.tx(async (client) => {
      const created = await insertBooking(client, [
        data.hotelSlug, data.roomId, hotel.name, room.name,
        data.name, data.email, data.phone, data.requests || null,
        data.checkIn, data.checkOut, nights, data.guests, data.rooms,
        rateCentavos, subtotal, tax, total,
      ]);
      await client.query(
        `insert into payments (booking_id, request_reference_number, amount_centavos)
         values ($1, $2, $3)`,
        [created.id, created.id, total],
      );
      return created;
    });

    let checkout;
    try {
      checkout = await maya.createCheckout({ bookingId: booking.id, totalCentavos: total });
    } catch (error) {
      console.error('[bookings] Maya checkout creation failed:', error.message, error.mayaCode ?? '');
      await db.query(`update payments set status = 'FAILED' where booking_id = $1`, [booking.id]);
      await db.query(`update bookings set status = 'PAYMENT_FAILED' where id = $1`, [booking.id]);
      return res.status(502).json({ message: 'We could not start the payment. Please try again in a moment.' });
    }

    await db.query(`update payments set maya_checkout_id = $2 where booking_id = $1`, [booking.id, checkout.checkoutId]);

    return res.status(201).json({
      ok: true,
      reference: booking.reference,
      bookingId: booking.id,
      status: 'PENDING_PAYMENT',
      checkoutUrl: checkout.redirectUrl,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Status for the payment result pages. The booking id is an unguessable
 * UUID, and the response carries no personal data (no name, email or phone).
 *
 * If payment is still pending we ask Maya right now (reconcile), so a
 * customer is confirmed even if the webhook is delayed or blocked. A
 * "success" redirect alone never changes anything — only Maya's answer does.
 */
const lastCheck = new Map();

router.get('/:id/status', statusLimiter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID.test(id)) return res.status(404).json({ message: 'Not found.' });

    let booking = await payments.getBooking(id);
    if (!booking) return res.status(404).json({ message: 'Not found.' });

    if (['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(booking.status)) {
      const now = Date.now();
      if (now - (lastCheck.get(id) ?? 0) > 4000) {
        lastCheck.set(id, now);
        if (lastCheck.size > 5000) lastCheck.clear();
        booking = (await payments.reconcile(id)) ?? booking;
      }
    }

    return res.json({
      reference: booking.reference,
      status: booking.status,
      hotelName: booking.hotel_name,
      roomName: booking.room_name,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      totalCentavos: booking.total_centavos,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
