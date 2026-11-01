/**
 * Catering payment tests (fake Maya + real Postgres).
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/tala_test npm test
 * Needs db/schema.sql AND db/catering-orders.sql applied.
 */
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const TEST_DB = process.env.TEST_DATABASE_URL
if (!TEST_DB) {
  console.log('TEST_DATABASE_URL not set — skipping catering tests')
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

let appServer, base, db, mailer
const emails = { owner: 0, customer: 0, alerts: [] }
const MAYA_IP = '3.1.207.200'

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
  mailer.sendCateringConfirmedToOwner = async () => { emails.owner += 1 }
  mailer.sendCateringConfirmationToCustomer = async () => { emails.customer += 1 }
  mailer.sendOwnerAlert = async (subject) => { emails.alerts.push(subject) }
  db = require('../lib/db')
  appServer = http.createServer(require('../index.js'))
  await new Promise((r) => appServer.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${appServer.address().port}`
})

after(async () => { appServer.close(); mayaServer.close(); await db.closePool() })

beforeEach(async () => {
  await db.query('truncate webhook_events, catering_orders restart identity cascade')
  fake.checkouts.length = 0
  fake.payments = {}
  emails.owner = 0; emails.customer = 0; emails.alerts.length = 0
})

const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
let ip = 0
const headers = (extra = {}) => ({ 'Content-Type': 'application/json', 'True-Client-IP': `198.51.100.${(ip += 1)}`, ...extra })
const post = (path, body, extra) => fetch(`${base}${path}`, { method: 'POST', headers: headers(extra), body: JSON.stringify(body) })
const get = (path) => fetch(`${base}${path}`, { headers: headers() })
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms))
const order = async (id) => (await db.query('select * from catering_orders where id = $1', [id])).rows[0]
const valid = (extra = {}) => ({
  name: 'Test Customer', email: 'customer@example.com', phone: '0917 123 4567',
  eventDate: day(20), venue: '123 Sample Street, Bulacan', packageId: 'handaan', guests: 50, days: 1, ...extra,
})
async function create(extra) { const res = await post('/api/catering-orders', valid(extra)); return { res, body: await res.json() } }
const paid = (id, over = {}) => [{ id: 'pay-1', requestReferenceNumber: id, status: 'PAYMENT_SUCCESS', isPaid: true, receiptNumber: 'RCPT-9', amount: { value: '70000.00' }, currency: 'PHP', ...over }]

test('creates an order and a checkout from the SERVER price, ignoring any price the browser sends', async () => {
  const { res, body } = await create({ total: 1, price: 1, rate: 1, pricePerGuest: 1 })
  assert.equal(res.status, 201)
  assert.match(body.checkoutUrl, /^https:\/\/payments\.maya\.ph\//)
  assert.equal(fake.checkouts[0].totalAmount.value, 70000) // 1400 x 50 x 1
  assert.equal(fake.checkouts[0].requestReferenceNumber, body.orderId)
  assert.equal(fake.checkouts[0].redirectUrl.success, `https://www.tala-ecs.com/payment/success?b=${body.orderId}&k=catering`)
  const row = await order(body.orderId)
  assert.equal(row.status, 'PENDING_PAYMENT')
  assert.equal(row.total_centavos, 7_000_000)
})

test('rejects unknown/bespoke packages, too few guests, bad input; refuses when payments are off', async () => {
  assert.equal((await create({ packageId: 'binyag' })).res.status, 400)
  assert.equal((await create({ packageId: '__proto__' })).res.status, 400)
  assert.equal((await create({ packageId: 'kasalo', guests: 49 })).res.status, 400)
  assert.equal((await create({ days: 0 })).res.status, 400)
  assert.equal((await create({ eventDate: day(-3) })).res.status, 400)
  assert.equal((await create({ email: 'nope' })).res.status, 400)
  assert.equal(fake.checkouts.length, 0)
  const key = process.env.MAYA_SECRET_KEY
  delete process.env.MAYA_SECRET_KEY
  assert.equal((await create()).res.status, 503)
  process.env.MAYA_SECRET_KEY = key
})

test('a forged success webhook does not confirm when Maya says unpaid', async () => {
  const { body } = await create()
  fake.payments[body.orderId] = [{ id: 'pay-1', requestReferenceNumber: body.orderId, status: 'PENDING_PAYMENT', isPaid: false }]
  await post('/api/maya/webhook', { id: 'pay-1', requestReferenceNumber: body.orderId, status: 'PAYMENT_SUCCESS' }, { 'True-Client-IP': MAYA_IP })
  await wait()
  assert.equal((await order(body.orderId)).status, 'PENDING_PAYMENT')
  assert.equal(emails.owner, 0)
})

test('wrong amount is not confirmed and alerts the owner', async () => {
  const { body } = await create()
  fake.payments[body.orderId] = paid(body.orderId, { amount: { value: '10.00' } })
  await post('/api/maya/webhook', { id: 'pay-1', requestReferenceNumber: body.orderId }, { 'True-Client-IP': MAYA_IP })
  await wait()
  assert.equal((await order(body.orderId)).status, 'PENDING_PAYMENT')
  assert.equal(emails.alerts.length, 1)
})

test('verified payment confirms once; duplicate webhooks change nothing', async () => {
  const { body } = await create()
  fake.payments[body.orderId] = paid(body.orderId)
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await post('/api/maya/webhook', { id: 'pay-1', requestReferenceNumber: body.orderId }, { 'True-Client-IP': MAYA_IP })).status, 200)
    await wait()
  }
  const row = await order(body.orderId)
  assert.equal(row.status, 'CONFIRMED')
  assert.equal(row.receipt_number, 'RCPT-9')
  assert.equal(row.owner_email_status, 'SENT')
  assert.equal(row.customer_email_status, 'SENT')
  assert.equal(emails.owner, 1)
  assert.equal(emails.customer, 1)
})

test('status endpoint confirms via Maya without a webhook and exposes no personal data', async () => {
  const { body } = await create()
  fake.payments[body.orderId] = paid(body.orderId)
  const status = await (await get(`/api/catering-orders/${body.orderId}/status`)).json()
  assert.equal(status.status, 'CONFIRMED')
  assert.equal(status.reference, body.reference)
  assert.equal(JSON.stringify(status).includes('customer@example.com'), false)
  assert.equal(JSON.stringify(status).includes('Test Customer'), false)
  assert.equal((await get('/api/catering-orders/not-a-uuid/status')).status, 404)
  assert.equal((await get('/api/catering-orders/123e4567-e89b-42d3-a456-426614174000/status')).status, 404)
})

test('failed and cancelled payments are reflected', async () => {
  const a = await create()
  fake.payments[a.body.orderId] = [{ id: 'p-a', requestReferenceNumber: a.body.orderId, status: 'PAYMENT_FAILED' }]
  await get(`/api/catering-orders/${a.body.orderId}/status`)
  assert.equal((await order(a.body.orderId)).status, 'PAYMENT_FAILED')
  const b = await create()
  fake.payments[b.body.orderId] = [{ id: 'p-b', requestReferenceNumber: b.body.orderId, status: 'PAYMENT_CANCELLED' }]
  await get(`/api/catering-orders/${b.body.orderId}/status`)
  assert.equal((await order(b.body.orderId)).status, 'CANCELLED')
})

test('sweep verifies unpaid orders after 3 minutes (missing-webhook safety net) and expires truly unpaid ones', async () => {
  const payments = require('../lib/payments')
  const missed = await create()   // paid, but no webhook ever arrived
  const unpaid = await create()   // never paid, hour is up
  fake.payments[missed.body.orderId] = paid(missed.body.orderId)
  await db.query(`update catering_orders set created_at = now() - interval '4 minutes' where id = $1`, [missed.body.orderId])
  await db.query(`update catering_orders set created_at = now() - interval '90 minutes', expires_at = now() - interval '30 minutes' where id = $1`, [unpaid.body.orderId])
  await payments.sweep()
  assert.equal((await order(missed.body.orderId)).status, 'CONFIRMED')
  assert.equal((await order(unpaid.body.orderId)).status, 'EXPIRED')
})

// ---- Down payments (payment_type FULL / DEPOSIT) -------------------------------------------

const kasalo = (extra = {}) => ({ packageId: 'kasalo', ...extra }) // 1100 x 50 x 1 = PHP 55,000.00 = 5,500,000 centavos
async function withEnv(name, value, fn) {
  const before = process.env[name]
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
  try { await fn() } finally {
    if (before === undefined) delete process.env[name]
    else process.env[name] = before
  }
}

test('no paymentOption charges the full total exactly as before, stored as FULL', async () => {
  const { res, body } = await create(kasalo())
  assert.equal(res.status, 201)
  assert.equal(fake.checkouts[0].totalAmount.value, 55000)
  assert.equal(body.paymentType, 'FULL')
  assert.equal(body.amountDueCentavos, 5_500_000)
  const row = await order(body.orderId)
  assert.equal(row.payment_type, 'FULL')
  assert.equal(row.amount_due_centavos, 5_500_000)
  const explicit = await create(kasalo({ paymentOption: 'full', amountPesos: '10' })) // amount ignored for 'full'
  assert.equal(explicit.res.status, 201)
  assert.equal(fake.checkouts[1].totalAmount.value, 55000)
})

test('custom amount creates a DEPOSIT checkout for exactly that amount; total is unchanged', async () => {
  const { res, body } = await create(kasalo({ paymentOption: 'custom', amountPesos: '5000.50' }))
  assert.equal(res.status, 201)
  assert.equal(fake.checkouts[0].totalAmount.value, 5000.5)
  assert.equal(body.paymentType, 'DEPOSIT')
  assert.equal(body.amountDueCentavos, 500_050)
  const row = await order(body.orderId)
  assert.equal(row.payment_type, 'DEPOSIT')
  assert.equal(row.amount_due_centavos, 500_050)
  assert.equal(row.total_centavos, 5_500_000)
  const numeric = await create(kasalo({ paymentOption: 'custom', amountPesos: 2500 })) // a number is accepted via String()
  assert.equal(numeric.res.status, 201)
  assert.equal(numeric.body.amountDueCentavos, 250_000)
})

test('custom amount equal to the total is stored as FULL', async () => {
  const { res, body } = await create(kasalo({ paymentOption: 'custom', amountPesos: '55000' }))
  assert.equal(res.status, 201)
  assert.equal(body.paymentType, 'FULL')
  assert.equal((await order(body.orderId)).payment_type, 'FULL')
  assert.equal(fake.checkouts[0].totalAmount.value, 55000)
})

test('invalid custom amounts and unknown options are rejected with 400 and create nothing', async () => {
  const cases = [
    kasalo({ paymentOption: 'custom', amountPesos: '0.50' }),
    kasalo({ paymentOption: 'custom', amountPesos: '55000.01' }),
    kasalo({ paymentOption: 'custom', amountPesos: '1.234' }),
    kasalo({ paymentOption: 'custom', amountPesos: '-5' }),
    kasalo({ paymentOption: 'custom', amountPesos: 'abc' }),
    kasalo({ paymentOption: 'custom', amountPesos: '1,000' }),
    kasalo({ paymentOption: 'custom', amountPesos: '₱1000' }),
    kasalo({ paymentOption: 'custom', amountPesos: '' }),
    kasalo({ paymentOption: 'custom' }),
    kasalo({ paymentOption: 'custom', amountPesos: { $gt: 1 } }),
    kasalo({ paymentOption: 'deposit', amountPesos: '1000' }),
    kasalo({ paymentOption: 7 }),
  ]
  for (const extra of cases) assert.equal((await create(extra)).res.status, 400, JSON.stringify(extra))
  assert.equal(fake.checkouts.length, 0)
  assert.equal((await db.query('select count(*)::int as n from catering_orders')).rows[0].n, 0)
  const low = await create(kasalo({ paymentOption: 'custom', amountPesos: '0.50' }))
  assert.equal(low.body.message, 'The minimum online payment is ₱1.00.')
  assert.ok(low.body.errors.amountPesos)
  const high = await create(kasalo({ paymentOption: 'custom', amountPesos: '60000' }))
  assert.equal(high.body.message, 'The amount cannot be more than the order total of ₱55,000.00.')
})

test('browser-sent amountDueCentavos / total / payment_type are ignored', async () => {
  const { res, body } = await create(kasalo({
    paymentOption: 'custom', amountPesos: '3000', amountDueCentavos: 100, total: 1, totalCentavos: 1, payment_type: 'FULL', paymentType: 'FULL',
  }))
  assert.equal(res.status, 201)
  assert.equal(body.amountDueCentavos, 300_000)
  assert.equal(fake.checkouts[0].totalAmount.value, 3000)
  const row = await order(body.orderId)
  assert.equal(row.payment_type, 'DEPOSIT')
  assert.equal(row.total_centavos, 5_500_000)
})

test('CATERING_MIN_PAYMENT_PESOS sets the minimum; invalid values fall back to PHP 1', async () => {
  await withEnv('CATERING_MIN_PAYMENT_PESOS', '100', async () => {
    assert.equal((await create(kasalo({ paymentOption: 'custom', amountPesos: '50' }))).res.status, 400)
    assert.equal((await create(kasalo({ paymentOption: 'custom', amountPesos: '100' }))).res.status, 201)
    const low = await create(kasalo({ paymentOption: 'custom', amountPesos: '99.99' }))
    assert.equal(low.body.message, 'The minimum online payment is ₱100.00.')
  })
  for (const bad of ['abc', '0', '100001', '1.234', '-5', '']) {
    await withEnv('CATERING_MIN_PAYMENT_PESOS', bad, async () => {
      assert.equal((await create(kasalo({ paymentOption: 'custom', amountPesos: '0.99' }))).res.status, 400, bad)
      assert.equal((await create(kasalo({ paymentOption: 'custom', amountPesos: '1' }))).res.status, 201, bad)
    })
  }
})

test('a deposit order is CONFIRMED only by a Maya payment equal to the amount due (replay harmless)', async () => {
  const { body } = await create(kasalo({ paymentOption: 'custom', amountPesos: '5000.50' }))
  fake.payments[body.orderId] = paid(body.orderId, { amount: { value: '5000.50' } })
  for (let i = 0; i < 2; i += 1) {
    await post('/api/maya/webhook', { id: 'pay-1', requestReferenceNumber: body.orderId }, { 'True-Client-IP': MAYA_IP })
    await wait()
  }
  const row = await order(body.orderId)
  assert.equal(row.status, 'CONFIRMED')
  assert.equal(row.payment_type, 'DEPOSIT')
  assert.equal(emails.owner, 1)
  assert.equal(emails.customer, 1)
  assert.equal(emails.alerts.length, 0)
})

test('a deposit order is NOT confirmed by a payment equal to the order total, and the owner is alerted', async () => {
  const { body } = await create(kasalo({ paymentOption: 'custom', amountPesos: '5000.50' }))
  fake.payments[body.orderId] = paid(body.orderId, { amount: { value: '55000.00' } })
  await post('/api/maya/webhook', { id: 'pay-1', requestReferenceNumber: body.orderId }, { 'True-Client-IP': MAYA_IP })
  await wait()
  assert.equal((await order(body.orderId)).status, 'PENDING_PAYMENT')
  assert.equal(emails.alerts.length, 1)
  assert.equal(emails.owner, 0)
})

test('delayed webhook: the sweep still confirms a deposit paid at the exact amount due', async () => {
  const payments = require('../lib/payments')
  const { body } = await create(kasalo({ paymentOption: 'custom', amountPesos: '1200' }))
  fake.payments[body.orderId] = paid(body.orderId, { amount: { value: '1200.00' } })
  await db.query(`update catering_orders set created_at = now() - interval '4 minutes' where id = $1`, [body.orderId])
  await payments.sweep()
  assert.equal((await order(body.orderId)).status, 'CONFIRMED')
})

test('status endpoint reports paymentType, amountPaidCentavos and balanceCentavos without personal data', async () => {
  const { body } = await create(kasalo({ paymentOption: 'custom', amountPesos: '5000.50' }))
  let status = await (await get(`/api/catering-orders/${body.orderId}/status`)).json()
  assert.equal(status.paymentType, 'DEPOSIT')
  assert.equal(status.amountPaidCentavos, 0)
  assert.equal(status.balanceCentavos, 5_500_000)
  fake.payments[body.orderId] = paid(body.orderId, { amount: { value: '5000.50' } })
  await wait(4100) // the status endpoint throttles Maya look-ups to one per 4 seconds per order
  status = await (await get(`/api/catering-orders/${body.orderId}/status`)).json()
  assert.equal(status.status, 'CONFIRMED')
  assert.equal(status.amountPaidCentavos, 500_050)
  assert.equal(status.balanceCentavos, 4_999_950)
  assert.equal(status.totalCentavos, 5_500_000)
  const text = JSON.stringify(status)
  for (const secret of ['customer@example.com', 'Test Customer', '0917', 'Sample Street']) assert.equal(text.includes(secret), false)
})
