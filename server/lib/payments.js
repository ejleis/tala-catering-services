/**
 * Payment reconciliation — the ONLY place a booking becomes CONFIRMED.
 *
 * TRUST MODEL
 *  - A webhook body, a redirect URL, or anything the browser sends is
 *    treated as a hint to go and ask Maya. It is never believed on its own.
 *  - We ask Maya (secret key, by OUR reference number) what happened, then
 *    compare reference, amount and currency with what is in our database.
 *    Only an exact match marks the booking paid.
 *  - Everything is idempotent: running reconcile() twice, or from the
 *    webhook and the polling endpoint at the same time, confirms once.
 */
const db = require('./db')
const maya = require('./maya')
const mailer = require('./mailer')

const PAID_STATUSES = new Set(['PAYMENT_SUCCESS', 'CAPTURED'])
const MAX_EMAIL_ATTEMPTS = 5

const log = (...args) => console.log('[payments]', ...args)

function pickStatus(payment) {
  return String(payment?.status ?? payment?.paymentStatus ?? '').toUpperCase()
}

/** Maya amounts are pesos; compare as whole centavos to avoid float drift. */
function pickCentavos(payment) {
  const candidates = [
    payment?.totalAmount?.value,
    payment?.amount?.value,
    typeof payment?.totalAmount !== 'object' ? payment?.totalAmount : undefined,
    typeof payment?.amount !== 'object' ? payment?.amount : undefined,
  ]
  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue
    const number = Number(value)
    if (Number.isFinite(number)) return Math.round(number * 100)
  }
  return null
}

function pickCurrency(payment) {
  const value = payment?.currency ?? payment?.totalAmount?.currency ?? payment?.amount?.currency
  return value ? String(value).toUpperCase() : null
}

async function alertOwner(subject, lines) {
  try {
    await mailer.sendOwnerAlert(subject, lines)
  } catch (error) {
    console.error('[payments] could not send owner alert:', error.message)
  }
}

async function getBooking(id) {
  const { rows } = await db.query('select * from bookings where id = $1', [id])
  return rows[0] ?? null
}

async function recordAudit(bookingId, payload, verified) {
  try {
    await db.query(
      `insert into webhook_events (maya_payment_id, payment_status, payload, verified, processed_at)
       values ($1, $2, $3, $4, now())`,
      [payload?.id ? String(payload.id).slice(0, 100) : null, pickStatus(payload).slice(0, 60) || null, JSON.stringify({ source: 'reconcile', bookingId, payment: payload }), verified],
    )
  } catch (error) {
    console.error('[payments] audit insert failed:', error.message)
  }
}

/**
 * Asks Maya about a booking and applies the verified outcome.
 * Returns the (possibly updated) booking row, or null if it does not exist.
 */
async function reconcile(bookingId) {
  let booking = await getBooking(bookingId)
  if (!booking) return null
  if (booking.status === 'CONFIRMED' || !maya.isEnabled()) return booking

  let payments
  try {
    payments = await maya.getPaymentsByReference(bookingId)
  } catch (error) {
    // Maya unreachable / not found yet: leave state alone, a later webhook or
    // poll will try again.
    log('lookup failed for', bookingId, error.message)
    return booking
  }

  const mine = payments.filter((p) => !p?.requestReferenceNumber || p.requestReferenceNumber === bookingId)
  const paid = mine.find((p) => PAID_STATUSES.has(pickStatus(p)) && p.isPaid !== false)

  if (paid) {
    const centavos = pickCentavos(paid)
    const currency = pickCurrency(paid)
    if (centavos !== booking.total_centavos || (currency && currency !== 'PHP')) {
      await recordAudit(bookingId, paid, false)
      await alertOwner(`Payment mismatch — booking ${booking.reference}`, [
        `Maya reports a successful payment, but it does not match our record. The booking was NOT confirmed.`,
        `Booking: ${booking.reference} (${booking.hotel_name})`,
        `Expected: PHP ${(booking.total_centavos / 100).toFixed(2)} — Maya reported: ${centavos === null ? 'unreadable amount' : (centavos / 100).toFixed(2)} ${currency ?? ''}`,
        `Please check this payment in Maya Manager before doing anything else.`,
      ])
      return booking
    }
    await recordAudit(bookingId, paid, true)
    return confirmBooking(booking, paid)
  }

  // Not paid: reflect failures / progress, but never regress a confirmed booking.
  const latest = mine[mine.length - 1]
  const status = pickStatus(latest)
  const mapping = {
    PAYMENT_PROCESSING: ['PROCESSING', 'PAYMENT_PROCESSING'],
    AUTHORIZED: ['PROCESSING', 'PAYMENT_PROCESSING'],
    PAYMENT_FAILED: ['FAILED', 'PAYMENT_FAILED'],
    PAYMENT_CANCELLED: ['CANCELLED', 'CANCELLED'],
    PAYMENT_EXPIRED: ['EXPIRED', 'EXPIRED'],
  }[status]
  if (mapping) {
    const [paymentStatus, bookingStatus] = mapping
    await db.tx(async (client) => {
      await client.query(
        `update payments set status = $2, maya_status = $3,
           maya_payment_id = coalesce(maya_payment_id, $4)
         where booking_id = $1 and status <> 'PAID'`,
        [bookingId, paymentStatus, status, latest?.id ? String(latest.id) : null],
      )
      await client.query(
        `update bookings set status = $2 where id = $1 and status not in ('CONFIRMED')`,
        [bookingId, bookingStatus],
      )
    }).catch((error) => console.error('[payments] state update failed:', error.message))
  }
  return getBooking(bookingId)
}

async function confirmBooking(booking, payment) {
  const previousStatus = booking.status
  let confirmed = false

  try {
    await db.tx(async (client) => {
      const { rows } = await client.query('select status from bookings where id = $1 for update', [booking.id])
      if (rows[0].status === 'CONFIRMED') return // someone else got here first
      await client.query(
        `update payments set status = 'PAID', maya_payment_id = $2, maya_status = $3,
           receipt_number = $4, fund_source = $5, paid_at = now()
         where id = (select id from payments where booking_id = $1 order by created_at desc limit 1)`,
        [
          booking.id,
          payment.id ? String(payment.id) : null,
          pickStatus(payment),
          payment.receiptNumber ? String(payment.receiptNumber).slice(0, 100) : null,
          typeof payment.fundSource === 'string' ? payment.fundSource : payment.fundSource?.type ?? null,
        ],
      )
      await client.query(`update bookings set status = 'CONFIRMED', confirmed_at = now() where id = $1`, [booking.id])
      confirmed = true
    })
  } catch (error) {
    console.error('[payments] confirm failed:', error.message)
    await alertOwner(`Could not record payment — booking ${booking.reference}`, [
      'Maya reports this booking as paid, but saving it failed. Please confirm it manually in Maya Manager.',
      `Booking: ${booking.reference}`,
    ])
    return getBooking(booking.id)
  }

  if (confirmed) {
    log('confirmed', booking.reference)
    const lateStates = ['EXPIRED', 'CANCELLED', 'PAYMENT_FAILED']
    if (lateStates.includes(previousStatus)) {
      await alertOwner(`Late payment — booking ${booking.reference}`, [
        `Payment arrived after this booking was marked ${previousStatus}. It is now CONFIRMED — please verify availability with the hotel.`,
      ])
    }
    await dispatchEmails(booking.id)
  }
  return getBooking(booking.id)
}

/** Sends owner + guest emails for a confirmed booking; failures are recorded and retried. */
async function dispatchEmails(bookingId) {
  const booking = await getBooking(bookingId)
  if (!booking || booking.status !== 'CONFIRMED' || booking.email_attempts >= MAX_EMAIL_ATTEMPTS) return

  const { rows } = await db.query(
    `select receipt_number from payments where booking_id = $1 order by created_at desc limit 1`,
    [bookingId],
  )
  const full = { ...booking, receipt_number: rows[0]?.receipt_number }

  const attempt = async (column, send) => {
    if (booking[column] === 'SENT') return
    try {
      await send(full)
      await db.query(`update bookings set ${column} = 'SENT' where id = $1`, [bookingId])
    } catch (error) {
      console.error(`[payments] ${column} failed:`, error.message)
      await db.query(`update bookings set ${column} = 'FAILED' where id = $1`, [bookingId])
    }
  }

  await db.query('update bookings set email_attempts = email_attempts + 1 where id = $1', [bookingId])
  await attempt('owner_email_status', mailer.sendBookingConfirmedToOwner)
  await attempt('guest_email_status', mailer.sendBookingConfirmationToGuest)
}

/** Background housekeeping: expire stale unpaid bookings, retry failed emails. */
async function sweep() {
  if (!maya.isEnabled()) return

  // Safety net for a missing webhook: a few minutes after creation, ask Maya
  // about every still-unpaid booking, so a customer who paid and closed the
  // tab is confirmed without waiting for the hour-long expiry below.
  const recent = await db.query(
    `select id from bookings
      where status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING')
        and created_at < now() - interval '3 minutes'
        and expires_at >= now() - interval '10 minutes'
      order by created_at limit 20`,
  )
  for (const { id } of recent.rows) await reconcile(id)

  const stale = await db.query(
    `select id from bookings
      where status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING')
        and expires_at < now() - interval '10 minutes'
      order by expires_at limit 20`,
  )
  for (const { id } of stale.rows) {
    const booking = await reconcile(id) // pay-then-expire race: ask Maya first
    if (booking && ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'].includes(booking.status)) {
      await db.tx(async (client) => {
        await client.query(`update bookings set status = 'EXPIRED' where id = $1 and status in ('PENDING_PAYMENT','PAYMENT_PROCESSING')`, [id])
        await client.query(`update payments set status = 'EXPIRED' where booking_id = $1 and status in ('PENDING','PROCESSING')`, [id])
      })
    }
  }

  const retry = await db.query(
    `select id from bookings
      where status = 'CONFIRMED' and email_attempts < $1
        and (owner_email_status <> 'SENT' or guest_email_status <> 'SENT')
      limit 20`,
    [MAX_EMAIL_ATTEMPTS],
  )
  for (const { id } of retry.rows) await dispatchEmails(id)

  // Catering orders have their own table and the same rules. A problem there
  // must never stop the hotel sweep above, so it is isolated.
  try {
    await require('./cateringPayments').sweep()
  } catch (error) {
    console.error('[payments] catering sweep error:', error.message)
  }
}

function startSweeper() {
  const timer = setInterval(() => sweep().catch((e) => console.error('[payments] sweep error:', e.message)), 5 * 60 * 1000)
  timer.unref()
}

module.exports = {
  reconcile, dispatchEmails, sweep, startSweeper, getBooking,
  // shared with lib/cateringPayments.js so both flows apply identical checks
  helpers: { PAID_STATUSES, pickStatus, pickCentavos, pickCurrency, alertOwner },
}
