const express = require('express')
const crypto = require('node:crypto')
const rateLimit = require('express-rate-limit')
const { validateCateringOrder, pesosToCentavos } =require('../lib/validation')
const db = require('../lib/db')
const maya = require('../lib/maya')
const cateringPayments = require('../lib/cateringPayments')
const { getClientIp } = require('../lib/clientIp')
const { testPesos } = require('../lib/testItem')

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
 * Rates provided by the client (confirmed 1 Nov 2026). They mirror
 * src/data/catering.js and must be kept identical in both files. Bespoke has
 * no online price on purpose.
 */
const PACKAGES = {
  kasalo: { name: 'Kasalo', rate: 1100, minimumGuests: 50 },
  handaan: { name: 'Handaan', rate: 1400, minimumGuests: 50 },
}

/** The real packages, plus the hidden test package while ALLOW_TEST_ITEM is on (see lib/testItem.js). */
function getPackages() {
  const pesos = testPesos()
  if (pesos === null) return PACKAGES
  return { ...PACKAGES, test: { name: 'Test Package (internal)', rate: pesos, minimumGuests: 1 } }
}

/**
 * Smallest online payment (down payment) in centavos. CATERING_MIN_PAYMENT_PESOS
 * must be a number from 1 to 100000 with at most two decimals, otherwise PHP 1.
 *
 * The PHP 1 default is the client's chosen minimum (1 Nov 2026). Maya publishes
 * no minimum; a real PHP 1.00 payment was accepted and voided on 1 Nov 2026.
 */
function minPaymentCentavos() {
  const raw = (process.env.CATERING_MIN_PAYMENT_PESOS ?? '').trim()
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) return 100
  const centavos = pesosToCentavos(raw)
  return centavos >= 100 && centavos <= 10_000_000 ? centavos : 100
}

const formatPesos = (centavos) =>
  `₱${Math.floor(centavos / 100).toLocaleString('en-US')}.${String(centavos % 100).padStart(2, '0')}`

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
            event_date, venue, guests, days, rate_centavos, total_centavos,
            payment_type, amount_due_centavos, expires_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now() + interval '60 minutes')
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

    const packages = getPackages()
    const pkg = Object.hasOwn(packages, data.packageId) ? packages[data.packageId] : null
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

    // What the customer pays online now. Full by default; or a down payment between the minimum and the total.
    let amountDue = total
    if (data.paymentOption === 'custom') {
      const requested = pesosToCentavos(data.amountPesos) // format already validated
      const minimum = Math.min(minPaymentCentavos(), total)
      if (requested < minimum) {
        return res.status(400).json({
          message: `The minimum online payment is ${formatPesos(minimum)}.`,
          errors: { amountPesos: `The minimum online payment is ${formatPesos(minimum)}.` },
        })
      }
      if (requested > total) {
        const message = `The amount cannot be more than the order total of ${formatPesos(total)}.`
        return res.status(400).json({ message, errors: { amountPesos: message } })
      }
      amountDue = requested
    }
    const paymentType = amountDue === total ? 'FULL' : 'DEPOSIT'

    const order = await db.tx((client) =>
      insertOrder(client, [
        data.packageId, pkg.name, data.name, data.email, data.phone,
        data.eventDate, data.venue, data.guests, data.days, rateCentavos, total,
        paymentType, amountDue,
      ]),
    )

    let checkout
    try {
      checkout = await maya.createCheckout({ bookingId: order.id, totalCentavos: amountDue, kind: 'catering' })
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
      paymentType,
      amountDueCentavos: amountDue,
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

    const amountPaid = order.status === 'CONFIRMED' ? Number(order.amount_due_centavos) : 0
    const total = Number(order.total_centavos)
    return res.json({
      paymentType: order.payment_type,
      amountPaidCentavos: amountPaid,
      balanceCentavos: total - amountPaid,
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
