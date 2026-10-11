/**
 * Maya webhook receiver.
 *
 * Maya does not sign webhooks, so nothing in the body is believed. The
 * defences, in order:
 *   1. Source IP must be one of Maya's published webhook IPs (via the
 *      platform-set client IP header — see lib/clientIp.js).
 *   2. The body is only used to find OUR booking id (a UUID we generated).
 *   3. We reply 200 immediately (Maya expects it within ~5 seconds), then
 *      ask Maya directly — with our secret key — what really happened and
 *      compare reference, amount and currency with our database
 *      (lib/payments.js). Retries from Maya are harmless: processing is
 *      idempotent.
 */
const express = require('express')
const rateLimit = require('express-rate-limit')
const db = require('../lib/db')
const maya = require('../lib/maya')
const payments = require('../lib/payments')
const cateringPayments = require('../lib/cateringPayments')
const { getClientIp } = require('../lib/clientIp')

const router = express.Router()

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Source: Maya's webhook documentation.
const IPS = {
  production: ['18.138.50.235', '3.1.207.200'],
  sandbox: ['13.229.160.234', '3.1.199.75'],
}

function allowedIps() {
  const override = (process.env.MAYA_WEBHOOK_IPS || '').split(',').map((v) => v.trim()).filter(Boolean)
  return override.length ? override : IPS[maya.environment()] ?? []
}

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
})

async function reconcileReference(ref) {
  const { rowCount } = await db.query('select 1 from catering_orders where id = $1', [ref])
  return rowCount > 0 ? cateringPayments.reconcileOrder(ref) : payments.reconcile(ref)
}

router.post('/webhook', limiter, async (req, res) => {
  const ip = getClientIp(req).replace(/^::ffff:/, '')
  if (!allowedIps().includes(ip)) {
    console.warn('[maya-webhook] rejected request from non-Maya address')
    return res.status(403).end()
  }

  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).end()

  const ref = typeof body.requestReferenceNumber === 'string' ? body.requestReferenceNumber : ''

  try {
    await db.query(
      `insert into webhook_events (maya_payment_id, payment_status, payload, source_ip)
       values ($1, $2, $3, $4)`,
      [
        typeof body.id === 'string' ? body.id.slice(0, 100) : null,
        typeof (body.status ?? body.paymentStatus) === 'string' ? String(body.status ?? body.paymentStatus).slice(0, 60) : null,
        JSON.stringify(body),
        ip,
      ],
    )
  } catch (error) {
    console.error('[maya-webhook] could not store event:', error.message)
    return res.status(500).end() // let Maya retry
  }

  res.status(200).json({ received: true })

  if (UUID.test(ref)) {
    // The reference is one of OUR ids: a catering order if one exists with it, otherwise a hotel booking.
    reconcileReference(ref).catch((error) => console.error('[maya-webhook] reconcile failed:', error.message))
  }
})

module.exports = router
