/**
 * End-to-end payment tests against a FAKE Maya server and a real Postgres.
 *
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/tala_test npm test
 *
 * The database must already have db/schema.sql applied. The fake Maya only
 * implements what lib/maya.js calls; it proves OUR logic (trust model, amount
 * checks, idempotency), not Maya's real responses.
 */
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const TEST_DB = process.env.TEST_DATABASE_URL
if (!TEST_DB) {
  console.log('TEST_DATABASE_URL not set — skipping payment tests')
  process.exit(0)
}

// ---- fake Maya ---------------------------------------------------------
const fake = { checkouts: [], payments: {}, publicKey: 'pk-test', secretKey: 'sk-test' }

const mayaServer = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const auth = req.headers.authorization
    const send = (code, body) => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.method === 'POST' && req.url === '/checkout/v1/checkouts') {
      if (auth !== `Basic ${Buffer.from(`${fake.publicKey}:`).toString('base64')}`) return send(401, { code: 'unauthorized' })
      const body = JSON.parse(Buffer.concat(chunks).toString())
      fake.checkouts.push(body)
      return send(200, { checkoutId: `chk-${fake.checkouts.length}`, redirectUrl: `https://payments.maya.ph/checkout?id=chk-${fake.checkouts.length}` })
    }
    const match = req.url.match(/^\/payments\/v1\/payment-rrns\/(.+)$/)
    if (req.method === 'GET' && match) {
      if (auth !== `Basic ${Buffer.from(`${fake.secretKey}:`).toString('base64')}`) return send(401, { code: 'unauthorized' })
      return send(200, fake.payments[decodeURIComponent(match[1])] ?? [])
    }
    send(404, {})
  })
})

// ---- app under test ------------------------------------------------------
let appServer, base, db, mailer
const emails = { ownerConfirmed: 0, guestConfirmed: 0, alerts: [] }
const MAYA_IP = '3.1.207.200'

function setEnv(mayaPort) {
  Object.assign(process.env, {
    DATABASE_URL: TEST_DB,
    MAYA_ENVIRONMENT: 'production',
    ALLOW_FAKE_MAYA: 'true',
    MAYA_API_BASE: `http://127.0.0.1:${mayaPort}`,
    MAYA_PUBLIC_KEY: fake.publicKey,
    MAYA_SECRET_KEY: fake.secretKey,
    FRONTEND_URL: 'https://www.tala-ecs.com',
    CLIENT_IP_HEADER: 'true-client-ip',
    CORS_ORIGIN: 'https://www.tala-ecs.com',
    OWNER_EMAIL: 'owner@example.com',
    MAIL_FROM: 'test@example.com',
    RESEND_API_KEY: 're_test',
  })
}

before(async () => {
  await new Promise((r) => mayaServer.listen(0, '127.0.0.1', r))
  setEnv(mayaServer.address().port)
  mailer = require('../lib/mailer')
  mailer.sendBookingConfirmedToOwner = async () => { emails.ownerConfirmed += 1 }
  mailer.sendBookingConfirmationToGuest = async () => { emails.guestConfirmed += 1 }
  mailer.sendOwnerAlert = async (subject) => { emails.alerts.push(subject) }
  db = require('../lib/db')
  const app = require('../index.js')
  appServer = http.createServer(app)
  await new Promise((r) => appServer.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${appServer.address().port}`
})

after(async () => {
  appServer.close()
  mayaServer.close()
  await db.closePool()
})

beforeEach(async () => {
  await db.query('truncate webhook_events, payments, bookings restart identity cascade')
  fake.checkouts.length = 0
  fake.payments = {}
  emails.ownerConfirmed = 0
  emails.guestConfirmed = 0
  emails.alerts.length = 0
  setEnv(mayaServer.address().port)
})

// ---- helpers ---------------------------------------------------------------
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
let ipCounter = 0
const validBooking = (extra = {}) => ({
  name: 'Test Guest', email: 'guest@example.com', phone: '0917 123 4567',
  hotelSlug: 'swiss-belhotel-blulane', roomId: 'sbb-suite',
  checkIn: day(10), checkOut: day(12), guests: 2, rooms: 1, ...extra,
})
const post = (path, body, headers = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'True-Client-IP': `198.51.100.${(ipCounter += 1)}`, ...headers },
    body: JSON.stringify(body),
  })
const get = (path) => fetch(`${base}${path}`, { headers: { 'True-Client-IP': `198.51.100.${(ipCounter += 1)}` } })
const webhook = (body, ip = MAYA_IP) => post('/api/maya/webhook', body, { 'True-Client-IP': ip })
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms))
const booking = async (id) => (await db.query('select * from bookings where id = $1', [id])).rows[0]
const paymentRow = async (id) => (await db.query('select * from payments where booking_id = $1', [id])).rows[0]

async function createBooking(extra) {
  const res = await post('/api/bookings', validBooking(extra))
  return { res, body: await res.json() }
}
const paidPayload = (id, over = {}) => [{
  id: 'pay-1', requestReferenceNumber: id, status: 'PAYMENT_SUCCESS', isPaid: true,
  receiptNumber: 'RCPT-1', amount: { value: '17920.00' }, currency: 'PHP', ...over,
}]

// ---- tests ---------------------------------------------------------------
test('creates a booking and a Maya checkout using the SERVER-computed total', async () => {
  const { res, body } = await createBooking({ total: 1, price: 1, rate: 1 }) // client "prices" are ignored
  assert.equal(res.status, 201)
  assert.match(body.checkoutUrl, /^https:\/\/payments\.maya\.ph\//)
  // 8000/night x 2 nights = 16000, +12% placeholder tax = 17920
  assert.equal(fake.checkouts[0].totalAmount.value, 17920)
  assert.equal(fake.checkouts[0].totalAmount.currency, 'PHP')
  assert.equal(fake.checkouts[0].requestReferenceNumber, body.bookingId)
  assert.equal(fake.checkouts[0].redirectUrl.success, `https://www.tala-ecs.com/payment/success?b=${body.bookingId}`)
  const row = await booking(body.bookingId)
  assert.equal(row.status, 'PENDING_PAYMENT')
  assert.equal(row.total_centavos, 1_792_000)
  assert.equal((await paymentRow(body.bookingId)).maya_checkout_id, 'chk-1')
})

test('MAYA_API_BASE is ignored unless ALLOW_FAKE_MAYA=true', async () => {
  const maya = require('../lib/maya')
  assert.match(maya.environment(), /production/)
  delete process.env.ALLOW_FAKE_MAYA
  await assert.rejects(() => maya.createCheckout({ bookingId: '123e4567-e89b-42d3-a456-426614174000', totalCentavos: 100 }))
  assert.equal(fake.checkouts.length, 0) // nothing reached the fake server
})

test('rejects unknown rooms and refuses bookings when payments are not configured', async () => {
  assert.equal((await createBooking({ roomId: 'nope' })).res.status, 400)
  delete process.env.MAYA_SECRET_KEY
  assert.equal((await createBooking()).res.status, 503)
})

test('webhook from a non-Maya address is rejected', async () => {
  const { body } = await createBooking()
  fake.payments[body.bookingId] = paidPayload(body.bookingId)
  const res = await webhook({ requestReferenceNumber: body.bookingId, status: 'PAYMENT_SUCCESS' }, '203.0.113.9')
  assert.equal(res.status, 403)
  await wait()
  assert.equal((await booking(body.bookingId)).status, 'PENDING_PAYMENT')
})

test('a FORGED success webhook does not confirm anything when Maya says unpaid', async () => {
  const { body } = await createBooking()
  fake.payments[body.bookingId] = [{ id: 'pay-1', requestReferenceNumber: body.bookingId, status: 'PENDING_PAYMENT', isPaid: false }]
  const res = await webhook({ id: 'pay-1', requestReferenceNumber: body.bookingId, status: 'PAYMENT_SUCCESS', isPaid: true })
  assert.equal(res.status, 200)
  await wait()
  assert.equal((await booking(body.bookingId)).status, 'PENDING_PAYMENT')
  assert.equal(emails.ownerConfirmed, 0)
})

test('a payment for the WRONG AMOUNT is not confirmed and alerts the owner', async () => {
  const { body } = await createBooking()
  fake.payments[body.bookingId] = paidPayload(body.bookingId, { amount: { value: '100.00' } })
  await webhook({ id: 'pay-1', requestReferenceNumber: body.bookingId })
  await wait()
  assert.equal((await booking(body.bookingId)).status, 'PENDING_PAYMENT')
  assert.equal(emails.ownerConfirmed, 0)
  assert.equal(emails.alerts.length, 1)
})

test('verified payment confirms the booking once; duplicate webhooks change nothing', async () => {
  const { body } = await createBooking()
  fake.payments[body.bookingId] = paidPayload(body.bookingId)
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await webhook({ id: 'pay-1', requestReferenceNumber: body.bookingId })).status, 200)
    await wait()
  }
  const row = await booking(body.bookingId)
  assert.equal(row.status, 'CONFIRMED')
  assert.equal(row.owner_email_status, 'SENT')
  assert.equal(row.guest_email_status, 'SENT')
  const pay = await paymentRow(body.bookingId)
  assert.equal(pay.status, 'PAID')
  assert.equal(pay.receipt_number, 'RCPT-1')
  assert.equal(emails.ownerConfirmed, 1)
  assert.equal(emails.guestConfirmed, 1)
})

test('status endpoint confirms via Maya even if the webhook never arrives, and exposes no personal data', async () => {
  const { body } = await createBooking()
  fake.payments[body.bookingId] = paidPayload(body.bookingId)
  const status = await (await get(`/api/bookings/${body.bookingId}/status`)).json()
  assert.equal(status.status, 'CONFIRMED')
  assert.equal(status.reference, body.reference)
  assert.equal('guest_email' in status || 'email' in status || 'guestName' in status, false)
  assert.equal((await get('/api/bookings/not-a-uuid/status')).status, 404)
})

test('failed and cancelled payments are reflected', async () => {
  const a = await createBooking()
  fake.payments[a.body.bookingId] = [{ id: 'p-a', requestReferenceNumber: a.body.bookingId, status: 'PAYMENT_FAILED' }]
  await get(`/api/bookings/${a.body.bookingId}/status`)
  assert.equal((await booking(a.body.bookingId)).status, 'PAYMENT_FAILED')

  const b = await createBooking()
  fake.payments[b.body.bookingId] = [{ id: 'p-b', requestReferenceNumber: b.body.bookingId, status: 'PAYMENT_CANCELLED' }]
  await get(`/api/bookings/${b.body.bookingId}/status`)
  assert.equal((await booking(b.body.bookingId)).status, 'CANCELLED')
})

test('sweep expires unpaid bookings but confirms ones that were paid after expiry', async () => {
  const payments = require('../lib/payments')
  const unpaid = await createBooking()
  const late = await createBooking()
  fake.payments[late.body.bookingId] = paidPayload(late.body.bookingId)
  await db.query(`update bookings set expires_at = now() - interval '1 hour'`)
  await payments.sweep()
  assert.equal((await booking(unpaid.body.bookingId)).status, 'EXPIRED')
  assert.equal((await booking(late.body.bookingId)).status, 'CONFIRMED')
})
