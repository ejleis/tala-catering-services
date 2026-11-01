/**
 * Hardening tests (fake Maya + real Postgres): one-time mismatch alerts,
 * atomic email claims, terminal states, late payment after expiry.
 *   TEST_DATABASE_URL=postgresql://postgres@localhost:5432/tala_test npm test
 * Needs db/schema.sql AND db/catering-orders.sql applied.
 */
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const TEST_DB = process.env.TEST_DATABASE_URL
if (!TEST_DB) {
  console.log('TEST_DATABASE_URL not set — skipping hardening tests')
  process.exit(0)
}

const fake = { checkouts: [], payments: {}, publicKey: 'pk-test', secretKey: 'sk-test' }
const mayaServer = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (req.method === 'POST' && req.url === '/checkout/v1/checkouts') {
      fake.checkouts.push(JSON.parse(Buffer.concat(chunks).toString()))
      return send(200, { checkoutId: `chk-${fake.checkouts.length}`, redirectUrl: `https://payments.maya.ph/checkout?id=chk-${fake.checkouts.length}` })
    }
    const match = req.url.match(/^\/payments\/v1\/payment-rrns\/(.+)$/)
    if (req.method === 'GET' && match) return send(200, fake.payments[decodeURIComponent(match[1])] ?? [])
    send(404, {})
  })
})

let appServer, base, db, mailer, payments, cateringPayments
const sent = { hotelOwner: 0, hotelGuest: 0, cateringOwner: 0, cateringCustomer: 0, alerts: [] }
const control = { delayMs: 0, failAlerts: false }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

before(async () => {
  await new Promise((r) => mayaServer.listen(0, '127.0.0.1', r))
  Object.assign(process.env, {
    DATABASE_URL: TEST_DB, MAYA_ENVIRONMENT: 'production', ALLOW_FAKE_MAYA: 'true',
    MAYA_API_BASE: `http://127.0.0.1:${mayaServer.address().port}`,
    MAYA_PUBLIC_KEY: fake.publicKey, MAYA_SECRET_KEY: fake.secretKey,
    FRONTEND_URL: 'https://www.tala-ecs.com', CLIENT_IP_HEADER: 'true-client-ip',
    CORS_ORIGIN: 'https://www.tala-ecs.com', OWNER_EMAIL: 'owner@example.com',
    MAIL_FROM: 'test@example.com', RESEND_API_KEY: 're_test',
  })
  mailer = require('../lib/mailer')
  mailer.sendBookingConfirmedToOwner = async () => { await sleep(control.delayMs); sent.hotelOwner += 1 }
  mailer.sendBookingConfirmationToGuest = async () => { await sleep(control.delayMs); sent.hotelGuest += 1 }
  mailer.sendCateringConfirmedToOwner = async () => { await sleep(control.delayMs); sent.cateringOwner += 1 }
  mailer.sendCateringConfirmationToCustomer = async () => { await sleep(control.delayMs); sent.cateringCustomer += 1 }
  mailer.sendOwnerAlert = async (subject) => {
    if (control.failAlerts) throw new Error('mail down')
    sent.alerts.push(subject)
  }
  db = require('../lib/db')
  payments = require('../lib/payments')
  cateringPayments = require('../lib/cateringPayments')
  appServer = http.createServer(require('../index.js'))
  await new Promise((r) => appServer.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${appServer.address().port}`
})

after(async () => { appServer.close(); mayaServer.close(); await db.closePool() })

beforeEach(async () => {
  await db.query('truncate webhook_events, payments, bookings, catering_orders restart identity cascade')
  fake.checkouts.length = 0
  fake.payments = {}
  Object.assign(sent, { hotelOwner: 0, hotelGuest: 0, cateringOwner: 0, cateringCustomer: 0 })
  sent.alerts.length = 0
  control.delayMs = 0
  control.failAlerts = false
})

const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
let ip = 0
const post = (path, body) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'True-Client-IP': `198.51.100.${(ip += 1)}` },
  body: JSON.stringify(body),
})
async function createBooking() {
  const res = await post('/api/bookings', {
    name: 'Test Guest', email: 'guest@example.com', phone: '0917 123 4567',
    hotelSlug: 'swiss-belhotel-blulane', roomId: 'sbb-suite', checkIn: day(10), checkOut: day(12), guests: 2, rooms: 1,
  })
  assert.equal(res.status, 201)
  return (await res.json()).bookingId
}
async function createOrder() {
  const res = await post('/api/catering-orders', {
    name: 'Test Customer', email: 'customer@example.com', phone: '0917 123 4567',
    eventDate: day(20), venue: '123 Sample Street, Bulacan', packageId: 'handaan', guests: 50, days: 1,
  })
  assert.equal(res.status, 201)
  return (await res.json()).orderId
}
const row = async (table, id) => (await db.query(`select * from ${table} where id = $1`, [id])).rows[0]
const reply = (id, status, over = {}) => [{ id: 'pay-1', requestReferenceNumber: id, status, isPaid: status === 'PAYMENT_SUCCESS', receiptNumber: 'RCPT-1', ...over }]
const HOTEL_OK = { amount: { value: '17920.00' }, currency: 'PHP' }
const CATERING_OK = { amount: { value: '70000.00' }, currency: 'PHP' }
const audits = async () => (await db.query(`select count(*)::int as n from webhook_events where verified = false`)).rows[0].n

// ---- mismatch alert flood ------------------------------------------------------
test('hotel: a wrong-amount payment alerts the owner ONCE across repeated reconciles, audit rows every time', async () => {
  const id = await createBooking()
  fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', { amount: { value: '100.00' }, currency: 'PHP' })
  for (let i = 0; i < 5; i += 1) await payments.reconcile(id)
  assert.equal(sent.alerts.length, 1)
  assert.equal(await audits(), 5)
  const booking = await row('bookings', id)
  assert.equal(booking.status, 'PENDING_PAYMENT')
  assert.notEqual(booking.mismatch_alerted_at, null)
})

test('hotel: overlapping reconciles still send a single mismatch alert', async () => {
  const id = await createBooking()
  fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', { amount: { value: '100.00' }, currency: 'PHP' })
  await Promise.all([1, 2, 3, 4].map(() => payments.reconcile(id)))
  assert.equal(sent.alerts.length, 1)
})

test('hotel: if the alert email fails, the next reconcile tries again', async () => {
  const id = await createBooking()
  fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', { amount: { value: '100.00' }, currency: 'PHP' })
  control.failAlerts = true
  await payments.reconcile(id)
  assert.equal((await row('bookings', id)).mismatch_alerted_at, null)
  control.failAlerts = false
  await payments.reconcile(id)
  await payments.reconcile(id)
  assert.equal(sent.alerts.length, 1)
})

test('catering: a wrong-amount payment alerts the owner ONCE across repeated reconciles, audit rows every time', async () => {
  const id = await createOrder()
  fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', { amount: { value: '10.00' }, currency: 'PHP' })
  for (let i = 0; i < 5; i += 1) await cateringPayments.reconcileOrder(id)
  assert.equal(sent.alerts.length, 1)
  assert.equal(await audits(), 5)
  const order = await row('catering_orders', id)
  assert.equal(order.status, 'PENDING_PAYMENT')
  assert.notEqual(order.mismatch_alerted_at, null)
})

// ---- duplicate confirmation emails -----------------------------------------------
test('hotel: concurrent dispatchEmails sends each email exactly once', async () => {
  const id = await createBooking()
  await db.query(`update bookings set status = 'CONFIRMED', confirmed_at = now() where id = $1`, [id])
  control.delayMs = 150
  await Promise.all([1, 2, 3, 4, 5].map(() => payments.dispatchEmails(id)))
  assert.equal(sent.hotelOwner, 1)
  assert.equal(sent.hotelGuest, 1)
  const booking = await row('bookings', id)
  assert.equal(booking.owner_email_status, 'SENT')
  assert.equal(booking.guest_email_status, 'SENT')
  assert.equal(booking.owner_email_claimed_at, null)
  await payments.dispatchEmails(id) // later runs do nothing
  assert.equal(sent.hotelOwner, 1)
})

test('catering: concurrent dispatchEmails sends each email exactly once', async () => {
  const id = await createOrder()
  await db.query(`update catering_orders set status = 'CONFIRMED', confirmed_at = now() where id = $1`, [id])
  control.delayMs = 150
  await Promise.all([1, 2, 3, 4, 5].map(() => cateringPayments.dispatchEmails(id)))
  assert.equal(sent.cateringOwner, 1)
  assert.equal(sent.cateringCustomer, 1)
})

test('a fresh claim is skipped; a claim older than 10 minutes is retried', async () => {
  const id = await createBooking()
  await db.query(`update bookings set status = 'CONFIRMED', confirmed_at = now() where id = $1`, [id])

  // fresh claim by a (hypothetical) running sender: skipped
  await db.query(`update bookings set owner_email_claimed_at = now() where id = $1`, [id])
  await payments.dispatchEmails(id)
  assert.equal(sent.hotelOwner, 0)
  assert.equal(sent.hotelGuest, 1) // the other email was free

  // crashed sender: claim older than 10 minutes -> retried
  await db.query(`update bookings set owner_email_claimed_at = now() - interval '11 minutes' where id = $1`, [id])
  await payments.dispatchEmails(id)
  assert.equal(sent.hotelOwner, 1)
  assert.equal(sent.hotelGuest, 1)

  // sweep picks up a stale-claimed, unsent email too
  const other = await createBooking()
  await db.query(`update bookings set status = 'CONFIRMED', owner_email_claimed_at = now() - interval '11 minutes' where id = $1`, [other])
  await payments.sweep()
  assert.equal(sent.hotelOwner, 2)
})

// ---- terminal states ---------------------------------------------------------
for (const terminal of ['EXPIRED', 'CANCELLED', 'PAYMENT_FAILED']) {
  test(`hotel: a later in-flight status does not resurrect a ${terminal} booking`, async () => {
    const id = await createBooking()
    await db.query(`update bookings set status = $2 where id = $1`, [id, terminal])
    await db.query(`update payments set status = $2 where booking_id = $1`, [id, terminal === 'PAYMENT_FAILED' ? 'FAILED' : terminal])
    fake.payments[id] = reply(id, 'PAYMENT_PROCESSING')
    await payments.reconcile(id)
    assert.equal((await row('bookings', id)).status, terminal)
    assert.notEqual((await db.query('select status from payments where booking_id = $1', [id])).rows[0].status, 'PROCESSING')
  })

  test(`catering: a later in-flight status does not resurrect a ${terminal} order`, async () => {
    const id = await createOrder()
    await db.query(`update catering_orders set status = $2 where id = $1`, [id, terminal])
    fake.payments[id] = reply(id, 'AUTHORIZED')
    await cateringPayments.reconcileOrder(id)
    assert.equal((await row('catering_orders', id)).status, terminal)
  })
}

test('in-flight status still moves a live booking/order to PAYMENT_PROCESSING', async () => {
  const b = await createBooking()
  fake.payments[b] = reply(b, 'PAYMENT_PROCESSING')
  await payments.reconcile(b)
  assert.equal((await row('bookings', b)).status, 'PAYMENT_PROCESSING')
  const o = await createOrder()
  fake.payments[o] = reply(o, 'PAYMENT_PROCESSING')
  await cateringPayments.reconcileOrder(o)
  assert.equal((await row('catering_orders', o)).status, 'PAYMENT_PROCESSING')
})

test('a FAILED or CANCELLED record still becomes EXPIRED when Maya reports the checkout expired (unchanged)', async () => {
  const b = await createBooking()
  await db.query(`update bookings set status = 'PAYMENT_FAILED' where id = $1`, [b])
  fake.payments[b] = reply(b, 'PAYMENT_EXPIRED')
  await payments.reconcile(b)
  assert.equal((await row('bookings', b)).status, 'EXPIRED')
  const o = await createOrder()
  await db.query(`update catering_orders set status = 'CANCELLED' where id = $1`, [o])
  fake.payments[o] = reply(o, 'PAYMENT_EXPIRED')
  await cateringPayments.reconcileOrder(o)
  assert.equal((await row('catering_orders', o)).status, 'EXPIRED')
})

// ---- late payment after expiry -------------------------------------------------
test('a verified payment arriving after EXPIRED still confirms (hotel and catering) and warns the owner', async () => {
  const b = await createBooking()
  await db.query(`update bookings set status = 'EXPIRED' where id = $1`, [b])
  await db.query(`update payments set status = 'EXPIRED' where booking_id = $1`, [b])
  fake.payments[b] = reply(b, 'PAYMENT_SUCCESS', HOTEL_OK)
  await payments.reconcile(b)
  assert.equal((await row('bookings', b)).status, 'CONFIRMED')
  assert.equal((await db.query('select status from payments where booking_id = $1', [b])).rows[0].status, 'PAID')
  assert.equal(sent.hotelOwner, 1)
  assert.ok(sent.alerts.some((s) => s.startsWith('Late payment')))

  const o = await createOrder()
  await db.query(`update catering_orders set status = 'EXPIRED' where id = $1`, [o])
  fake.payments[o] = reply(o, 'PAYMENT_SUCCESS', CATERING_OK)
  await cateringPayments.reconcileOrder(o)
  assert.equal((await row('catering_orders', o)).status, 'CONFIRMED')
  assert.equal(sent.cateringOwner, 1)
  assert.equal(sent.alerts.filter((s) => s.startsWith('Late payment')).length, 2)
})

// ---- L-1: lost mismatch alerts ---------------------------------------------------
const WRONG = { amount: { value: '100.00' }, currency: 'PHP' }
const mismatchAlerts = () => sent.alerts.filter((s) => s.startsWith('Payment mismatch')).length

for (const status of ['PENDING_PAYMENT', 'EXPIRED']) {
  test(`hotel: a stale unsent mismatch claim is re-sent by the sweep (${status}), once, and the record is not resurrected`, async () => {
    const id = await createBooking()
    fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', WRONG)
    await db.query(
      `update bookings set status = $2, mismatch_alerted_at = now() - interval '11 minutes',
         expires_at = now() - interval '1 day' where id = $1`, [id, status])
    await payments.sweep()
    assert.equal(mismatchAlerts(), 1)
    const booking = await row('bookings', id)
    assert.notEqual(booking.mismatch_alert_sent_at, null)
    assert.notEqual(booking.status, 'CONFIRMED')
    if (status === 'EXPIRED') assert.equal(booking.status, 'EXPIRED')
    await payments.sweep() // sent -> never again
    assert.equal(mismatchAlerts(), 1)
  })
}

test('hotel: a fresh claim (1 minute) is not re-sent; a sent alert is never re-sent', async () => {
  const id = await createBooking()
  fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', WRONG)
  await db.query(`update bookings set mismatch_alerted_at = now() - interval '1 minute' where id = $1`, [id])
  await payments.sweep()
  await payments.reconcile(id)
  assert.equal(sent.alerts.length, 0)
  await db.query(`update bookings set mismatch_alerted_at = now() - interval '11 minutes', mismatch_alert_sent_at = now() where id = $1`, [id])
  await payments.sweep()
  await payments.reconcile(id)
  assert.equal(sent.alerts.length, 0)
})

test('catering: a stale unsent claim is re-sent (also EXPIRED); fresh and sent ones are not', async () => {
  const stale = await createOrder()
  const fresh = await createOrder()
  const done = await createOrder()
  for (const id of [stale, fresh, done]) fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', { amount: { value: '10.00' }, currency: 'PHP' })
  await db.query(`update catering_orders set status = 'EXPIRED', expires_at = now() - interval '1 day', mismatch_alerted_at = now() - interval '11 minutes' where id = $1`, [stale])
  await db.query(`update catering_orders set mismatch_alerted_at = now() - interval '1 minute' where id = $1`, [fresh])
  await db.query(`update catering_orders set mismatch_alerted_at = now() - interval '11 minutes', mismatch_alert_sent_at = now() where id = $1`, [done])
  await payments.sweep()
  assert.equal(sent.alerts.length, 1)
  const o = await row('catering_orders', stale)
  assert.equal(o.status, 'EXPIRED')
  assert.notEqual(o.mismatch_alert_sent_at, null)
})

test('a failed claim release is logged, not swallowed', async () => {
  const id = await createBooking()
  fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', WRONG)
  control.failAlerts = true
  const realQuery = db.query
  const realError = console.error
  const logged = []
  db.query = (text, ...rest) => (String(text).includes('mismatch_alerted_at = null') ? Promise.reject(new Error('db down')) : realQuery(text, ...rest))
  console.error = (...args) => logged.push(args.join(' '))
  try {
    await payments.reconcile(id)
  } finally {
    db.query = realQuery
    console.error = realError
  }
  assert.ok(logged.some((l) => l.includes('could not release mismatch alert claim')))
  // the claim stays set; once stale, the sweep sends it
  control.failAlerts = false
  await db.query(`update bookings set mismatch_alerted_at = now() - interval '11 minutes' where id = $1`, [id])
  await payments.sweep()
  assert.equal(sent.alerts.length, 1)
})

// ---- L-2: failed / cancelled records are re-checked -------------------------------------
for (const terminal of ['PAYMENT_FAILED', 'CANCELLED']) {
  test(`hotel: a ${terminal} booking inside the window is confirmed by the sweep when Maya reports a matching payment`, async () => {
    const id = await createBooking()
    await db.query(`update bookings set status = $2, created_at = now() - interval '5 minutes' where id = $1`, [id, terminal])
    fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', HOTEL_OK)
    await payments.sweep()
    assert.equal((await row('bookings', id)).status, 'CONFIRMED')
    assert.ok(sent.alerts.some((s) => s.startsWith('Late payment')))
    assert.equal(sent.hotelOwner, 1)
  })

  test(`hotel: a ${terminal} booking outside the window is not re-checked`, async () => {
    const id = await createBooking()
    await db.query(`update bookings set status = $2, created_at = now() - interval '2 hours', expires_at = now() - interval '30 minutes' where id = $1`, [id, terminal])
    fake.payments[id] = reply(id, 'PAYMENT_SUCCESS', HOTEL_OK)
    await payments.sweep()
    assert.equal((await row('bookings', id)).status, terminal)
  })

  test(`catering: a ${terminal} order inside the window is confirmed by the sweep; outside it is not`, async () => {
    const inside = await createOrder()
    const outside = await createOrder()
    await db.query(`update catering_orders set status = $2, created_at = now() - interval '5 minutes' where id = $1`, [inside, terminal])
    await db.query(`update catering_orders set status = $2, created_at = now() - interval '2 hours', expires_at = now() - interval '30 minutes' where id = $1`, [outside, terminal])
    fake.payments[inside] = reply(inside, 'PAYMENT_SUCCESS', CATERING_OK)
    fake.payments[outside] = reply(outside, 'PAYMENT_SUCCESS', CATERING_OK)
    await payments.sweep()
    assert.equal((await row('catering_orders', inside)).status, 'CONFIRMED')
    assert.equal((await row('catering_orders', outside)).status, terminal)
    assert.ok(sent.alerts.some((s) => s.startsWith('Late payment')))
  })
}

test('wrong-amount then correct-amount paid entries confirm; only a wrong amount stays a mismatch', async () => {
  const b = await createBooking()
  fake.payments[b] = [
    ...reply(b, 'PAYMENT_SUCCESS', { id: 'pay-w', ...WRONG }),
    ...reply(b, 'PAYMENT_SUCCESS', { id: 'pay-r', ...HOTEL_OK }),
  ]
  await payments.reconcile(b)
  assert.equal((await row('bookings', b)).status, 'CONFIRMED')
  assert.equal(mismatchAlerts(), 0)

  const o = await createOrder()
  fake.payments[o] = [
    ...reply(o, 'PAYMENT_SUCCESS', { id: 'pay-w', amount: { value: '10.00' }, currency: 'PHP' }),
    ...reply(o, 'PAYMENT_SUCCESS', { id: 'pay-r', ...CATERING_OK }),
  ]
  await cateringPayments.reconcileOrder(o)
  assert.equal((await row('catering_orders', o)).status, 'CONFIRMED')

  const b2 = await createBooking()
  fake.payments[b2] = reply(b2, 'PAYMENT_SUCCESS', WRONG)
  await payments.reconcile(b2)
  assert.equal((await row('bookings', b2)).status, 'PENDING_PAYMENT')
  assert.equal(mismatchAlerts(), 1)
})
