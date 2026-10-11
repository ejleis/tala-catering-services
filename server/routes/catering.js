const express = require('express')
const crypto = require('node:crypto')
const rateLimit = require('express-rate-limit')
const { validateCateringOrder } = require('../lib/validation')
const db = require('../lib/db')
const maya = require('../lib/maya')
const cateringPayments = require('../lib/cateringPayments')
const { getClientIp } = require('../lib/clientIp')

const router = express.Router()

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: 'Too many order requests. Please try again later.' },
})

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { message: 'Too many requests. Please slow down.' },
})

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Server-side package catalogue.
 *
 * CRITICAL: prices live here, never in the request body. The browser sends a
 * package id, guests and days; the server looks the rate up and computes the
 * total itself.
 *
 * [NEEDS PROOF] These rates mirror src/data/catering.js, which the client has
 * not yet confirmed. They must be confirmed BEFORE real customers pay, and
 * kept identical in both files. Bespoke has no online price on purpose.
 */
const PACKAGES = {
  kasalo: { name: 'Kasalo', rate: 1100, minimumGuests: 50 },
  handaan: { name: 'Handaan', rate: 1400, minimumGuests: 50 },
}

function buildReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = crypto.randomInt(0, 10_000).toString().padStart(4, '0')
  return `CO-${date}-${suffix}`
}

async function insertOrder(client, row) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const { rows } = await client.query(
        `insert into catering_orders
           (reference, package_id, package_name, customer_name, customer_email, customer_phone,
            event_date, venue, guests, days, rate_centavos, total_centavos, expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now() + interval '60 minutes')
         returning id, reference`,
        [buildReference(), ...row],
      )
      return rows[0]
    } catch (error) {
      if (error.code !== '23505' || attempt === 4) throw error
    }
  }
  return null
}

router.post('/', submitLimiter, async (req, res, next) => {
  try {
    if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
      return res.status(200).json({ ok: true })
    }

    // Same safety switch as hotel bookings: no Maya keys / database, no orders.
    if (!maya.isEnabled() || !process.env.DATABASE_URL) {
      return res.status(503).json({ message: 'Online payment is temporarily unavailable. Please send us an inquiry instead.' })
    }

    const { data, errors } = validateCateringOrder(req.body)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
    }

    const pkg = Object.hasOwn(PACKAGES, data.packageId) ? PACKAGES[data.packageId] : null
    if (!pkg) {
      return res.status(400).json({ message: 'That package cannot be paid online.', errors: { packageId: 'Unknown package.' } })
    }
    if (data.guests < pkg.minimumGuests) {
      return res.status(400).json({
        message: `${pkg.name} requires at least ${pkg.minimumGuests} guests.`,
        errors: { guests: `Minimum ${pkg.minimumGuests} guests.` },
      })
    }

    // All money is whole centavos from here on; the browser's numbers are never used.
    const rateCentavos = Math.round(pkg.rate * 100)
    const total = rateCentavos * data.guests * data.days

    const order = await db.tx((client) =>
      insertOrder(client, [
        data.packageId, pkg.name, data.name, data.email, data.phone,
        data.eventDate, data.venue, data.guests, data.days, rateCentavos, total,
      ]),
    )

    let checkout
    try {
      checkout = await maya.createCheckout({ bookingId: order.id, totalCentavos: total, kind: 'catering' })
    } catch (error) {
      console.error('[catering] Maya checkout creation failed:', error.message, error.mayaCode ?? '')
      await db.query(`update catering_orders set status = 'PAYMENT_FAILED' where id = $1`, [order.id])
      return res.status(502).json({ message: 'We could not start the payment. Please try again in a moment.' })
    }

    await db.query(`update catering_orders set maya_checkout_id = $2 where id = $1`, [order.id, checkout.checkoutId])

    return res.status(201).json({
      ok: true,
      reference: order.reference,
      orderId: order.id,
      status: 'PENDING_PAYMENT',
      checkoutUrl: checkout.redirectUrl,
    })
  } catch (error) {
    return next(error)
  }
})

/**
 * Status for the payment result page. Unguessable UUID, no personal data in
 * the response. While unpaid we ask Maya right now (reconcile), so the
 * customer is confirmed even if the webhook is delayed or blocked.
 */
const lastCheck = new Map()

router.get('/:id/status', statusLimiter, async (req, res, next) => {
  try {
    const { id } = req.params
    if (!UUID.test(id)) return res.status(404).json({ message: 'Not found.' })

    let order = await cateringPayments.getOrder(id)
    if (!order) return res.status(404).json({ message: 'Not found.' })

    if (['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status)) {
      const now = Date.now()
      if (now - (lastCheck.get(id) ?? 0) > 4000) {
        lastCheck.set(id, now)
        if (lastCheck.size > 5000) lastCheck.clear()
        order = (await cateringPayments.reconcileOrder(id)) ?? order
      }
    }

    return res.json({
      reference: order.reference,
      status: order.status,
      packageName: order.package_name,
      eventDate: order.event_date,
      guests: order.guests,
      days: order.days,
      totalCentavos: order.total_centavos,
    })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
