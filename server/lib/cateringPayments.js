/**
 * Catering order payment reconciliation — the ONLY place a catering order
 * becomes CONFIRMED. Same trust model as lib/payments.js (hotel bookings):
 *
 *  - Webhooks, redirect URLs and anything from the browser are hints to go
 *    and ask Maya. They are never believed on their own.
 *  - We ask Maya (secret key, by OUR order id) and compare reference, amount
 *    and currency with our database. Only an exact match confirms the order.
 *  - Idempotent: safe to run from the webhook, the polling endpoint and the
 *    background sweep at the same time.
 */
const db = require('./db')
const maya = require('./maya')
const mailer = require('./mailer')
const { helpers } = require('./payments')

const { PAID_STATUSES, pickStatus, pickCentavos, pickCurrency, alertOwner } = helpers
const MAX_EMAIL_ATTEMPTS = 5
const log = (...args) => console.log('[catering-payments]', ...args)

async function getOrder(id) {
  const { rows } = await db.query('select * from catering_orders where id = $1', [id])
  return rows[0] ?? null
}

async function recordAudit(orderId, payload, verified) {
  try {
    await db.query(
      `insert into webhook_events (maya_payment_id, payment_status, payload, verified, processed_at)
       values ($1, $2, $3, $4, now())`,
      [payload?.id ? String(payload.id).slice(0, 100) : null, pickStatus(payload).slice(0, 60) || null, JSON.stringify({ source: 'reconcile', kind: 'catering', orderId, payment: payload }), verified],
    )
  } catch (error) {
    console.error('[catering-payments] audit insert failed:', error.message)
  }
}

/** Asks Maya about an order and applies the verified outcome. Returns the order row or null. */
async function reconcileOrder(orderId) {
  const order = await getOrder(orderId)
  if (!order) return null
  if (order.status === 'CONFIRMED' || !maya.isEnabled()) return order

  let payments
  try {
    payments = await maya.getPaymentsByReference(orderId)
  } catch (error) {
    log('lookup failed for', orderId, error.message)
    return order
  }

  const mine = payments.filter((p) => !p?.requestReferenceNumber || p.requestReferenceNumber === orderId)
  const paid = mine.find((p) => PAID_STATUSES.has(pickStatus(p)) && p.isPaid !== false)

  if (paid) {
    const centavos = pickCentavos(paid)
    const currency = pickCurrency(paid)
    if (centavos !== order.total_centavos || (currency && currency !== 'PHP')) {
      await recordAudit(orderId, paid, false)
      await alertOwner(`Payment mismatch — catering order ${order.reference}`, [
        'Maya reports a successful payment, but it does not match our record. The order was NOT confirmed.',
        `Order: ${order.reference} (${order.package_name})`,
        `Expected: PHP ${(order.total_centavos / 100).toFixed(2)} — Maya reported: ${centavos === null ? 'unreadable amount' : (centavos / 100).toFixed(2)} ${currency ?? ''}`,
        'Please check this payment in Maya Manager before doing anything else.',
      ])
      return order
    }
    await recordAudit(orderId, paid, true)
    return confirmOrder(order, paid)
  }

  const latest = mine[mine.length - 1]
  const status = pickStatus(latest)
  const mapping = {
    PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
    AUTHORIZED: 'PAYMENT_PROCESSING',
    PAYMENT_FAILED: 'PAYMENT_FAILED',
    PAYMENT_CANCELLED: 'CANCELLED',
    PAYMENT_EXPIRED: 'EXPIRED',
  }[status]
  if (mapping) {
    await db
      .query(
        `update catering_orders set status = $2, maya_status = $3,
           maya_payment_id = coalesce(maya_payment_id, $4)
         where id = $1 and status <> 'CONFIRMED'`,
        [orderId, mapping, status, latest?.id ? String(latest.id) : null],
      )
      .catch((error) => console.error('[catering-payments] state update failed:', error.message))
  }
  return getOrder(orderId)
}

async function confirmOrder(order, payment) {
  const previousStatus = order.status
  let confirmed = false

  try {
    await db.tx(async (client) => {
      const { rows } = await client.query('select status from catering_orders where id = $1 for update', [order.id])
      if (rows[0].status === 'CONFIRMED') return
      await client.query(
        `update catering_orders set status = 'CONFIRMED', confirmed_at = now(), paid_at = now(),
           maya_payment_id = $2, maya_status = $3, receipt_number = $4, fund_source = $5
         where id = $1`,
        [
          order.id,
          payment.id ? String(payment.id) : null,
          pickStatus(payment),
          payment.receiptNumber ? String(payment.receiptNumber).slice(0, 100) : null,
          typeof payment.fundSource === 'string' ? payment.fundSource : payment.fundSource?.type ?? null,
        ],
      )
      confirmed = true
    })
  } catch (error) {
    console.error('[catering-payments] confirm failed:', error.message)
    await alertOwner(`Could not record payment — catering order ${order.reference}`, [
      'Maya reports this order as paid, but saving it failed. Please confirm it manually in Maya Manager.',
      `Order: ${order.reference}`,
    ])
    return getOrder(order.id)
  }

  if (confirmed) {
    log('confirmed', order.reference)
    if (['EXPIRED', 'CANCELLED', 'PAYMENT_FAILED'].includes(previousStatus)) {
      await alertOwner(`Late payment — catering order ${order.reference}`, [
        `Payment arrived after this order was marked ${previousStatus}. It is now CONFIRMED — please contact the customer.`,
      ])
    }
    await dispatchEmails(order.id)
  }
  return getOrder(order.id)
}

/** Owner + customer emails for a confirmed order; failures are recorded and retried. */
async function dispatchEmails(orderId) {
  const order = await getOrder(orderId)
  if (!order || order.status !== 'CONFIRMED' || order.email_attempts >= MAX_EMAIL_ATTEMPTS) return

  const attempt = async (column, send) => {
    if (order[column] === 'SENT') return
    try {
      await send(order)
      await db.query(`update catering_orders set ${column} = 'SENT' where id = $1`, [orderId])
    } catch (error) {
      console.error(`[catering-payments] ${column} failed:`, error.message)
      await db.query(`update catering_orders set ${column} = 'FAILED' where id = $1`, [orderId])
    }
  }

  await db.query('update catering_orders set email_attempts = email_attempts + 1 where id = $1', [orderId])
  await attempt('owner_email_status', mailer.sendCateringConfirmedToOwner)
  await attempt('customer_email_status', mailer.sendCateringConfirmationToCustomer)
}

/** Background housekeeping for catering orders (called from payments.sweep). */
async function sweep() {
  if (!maya.isEnabled()) return

  // Missing-webhook safety net: verify unpaid orders a few minutes after creation.
  const recent = await db.query(
    `select id from catering_orders
      where status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING')
        and created_at < now() - interval '3 minutes'
        and expires_at >= now() - interval '10 minutes'
      order by created_at limit 20`,
  )
  for (const { id } of recent.rows) await reconcileOrder(id)

  const stale = await db.query(
    `select id from catering_orders
      where status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING')
        and expires_at < now() - interval '10 minutes'
      order by expires_at limit 20`,
  )
  for (const { id } of stale.rows) {
    const order = await reconcileOrder(id) // pay-then-expire race: ask Maya first
    if (order && ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(order.status)) {
      await db.query(
        `update catering_orders set status = 'EXPIRED' where id = $1 and status in ('PENDING_PAYMENT','PAYMENT_PROCESSING')`,
        [id],
      )
    }
  }

  const retry = await db.query(
    `select id from catering_orders
      where status = 'CONFIRMED' and email_attempts < $1
        and (owner_email_status <> 'SENT' or customer_email_status <> 'SENT')
      limit 20`,
    [MAX_EMAIL_ATTEMPTS],
  )
  for (const { id } of retry.rows) await dispatchEmails(id)
}

module.exports = { reconcileOrder, dispatchEmails, sweep, getOrder }
