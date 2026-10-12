/**
 * Hidden test item (lib/testItem.js): off by default, priced only from server env,
 * reachable only by direct request. Fake Maya + real Postgres, like the other tests.
 *   TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/tala_test npm test
 */
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

const TEST_DB = process.env.TEST_DATABASE_URL
if (!TEST_DB) {
  console.log('TEST_DATABASE_URL not set — skipping test-item tests')
  process.exit(0)
}

const fake = { checkouts: [] }
const mayaServer = http.createServer((req, res) => {
  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    if (req.method === 'POST' && req.url === '/checkout/v1/checkouts') {
      fake.checkouts.push(JSON.parse(Buffer.concat(chunks).toString()))
      return res.end(JSON.stringify({ checkoutId: `chk-${fake.checkouts.length}`, redirectUrl: 'https://payments.maya.ph/checkout?id=x' }))
    }
    res.end('[]')
  })
})

let appServer, base, db
before(async () => {
  await new Promise((r) => mayaServer.listen(0, '127.0.0.1', r))
  Object.assign(process.env, {
    DATABASE_URL: TEST_DB, MAYA_ENVIRONMENT: 'production', ALLOW_FAKE_MAYA: 'true',
    MAYA_API_BASE: `http://127.0.0.1:${mayaServer.address().port}`,
    MAYA_PUBLIC_KEY: 'pk-test', MAYA_SECRET_KEY: 'sk-test',
    FRONTEND_URL: 'https://www.tala-ecs.com', CLIENT_IP_HEADER: 'true-client-ip',
    CORS_ORIGIN: 'https://www.tala-ecs.com', OWNER_EMAIL: 'owner@example.com',
    MAIL_FROM: 'test@example.com', RESEND_API_KEY: 're_test',
  })
  db = require('../lib/db')
  appServer = http.createServer(require('../index.js'))
  await new Promise((r) => appServer.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${appServer.address().port}`
})
after(async () => { appServer.close(); mayaServer.close(); await db.closePool() })
beforeEach(async () => {
  await db.query('truncate webhook_events, payments, bookings, catering_orders restart identity cascade')
  fake.checkouts.length = 0
  delete process.env.ALLOW_TEST_ITEM
  delete process.env.TEST_ITEM_PESOS
})

const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
let ip = 0
const post = (path, body) => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'True-Client-IP': `198.51.100.${(ip += 1)}` },
  body: JSON.stringify(body),
})
const hotel = (extra = {}) => ({
  name: 'Tester', email: 'tester@example.com', phone: '0917 123 4567',
  hotelSlug: 'test-hotel', roomId: 'test-room', checkIn: day(10), checkOut: day(11), guests: 1, rooms: 1, ...extra,
})
const catering = (extra = {}) => ({
  name: 'Tester', email: 'tester@example.com', phone: '0917 123 4567',
  eventDate: day(10), venue: '1 Test Street', packageId: 'test', guests: 1, days: 1, ...extra,
})

test('OFF by default: test room and package are unknown', async () => {
  assert.equal((await post('/api/bookings', hotel())).status, 400)
  assert.equal((await post('/api/catering-orders', catering())).status, 400)
  assert.equal(fake.checkouts.length, 0)
})

test('ON without a valid price stays OFF', async () => {
  process.env.ALLOW_TEST_ITEM = 'true'
  for (const bad of [undefined, '', '0', '0.5', '101', '5000', 'abc', '1.234', '-1']) {
    if (bad === undefined) delete process.env.TEST_ITEM_PESOS
    else process.env.TEST_ITEM_PESOS = bad
    assert.equal((await post('/api/bookings', hotel())).status, 400, `price ${bad}`)
  }
  delete process.env.ALLOW_TEST_ITEM
  process.env.TEST_ITEM_PESOS = '1' // price alone is not enough
  assert.equal((await post('/api/bookings', hotel())).status, 400)
})

test('ON: hotel test room is priced from the server variable (1 night, +placeholder tax), not the request', async () => {
  process.env.ALLOW_TEST_ITEM = 'true'
  process.env.TEST_ITEM_PESOS = '1'
  const res = await post('/api/bookings', hotel({ total: 99999, rate: 99999, price: 99999 }))
  assert.equal(res.status, 201)
  assert.equal(fake.checkouts[0].totalAmount.value, 1.12) // 1.00 + 12% tax
  const row = (await db.query('select * from bookings')).rows[0]
  assert.equal(row.total_centavos, 112)
  assert.equal(row.hotel_name, 'Test Hotel (internal)')
})

test('ON: catering test package costs the variable per guest', async () => {
  process.env.ALLOW_TEST_ITEM = 'true'
  process.env.TEST_ITEM_PESOS = '2.5'
  const res = await post('/api/catering-orders', catering({ guests: 2 }))
  assert.equal(res.status, 201)
  assert.equal(fake.checkouts[0].totalAmount.value, 5)
  assert.equal((await db.query('select total_centavos from catering_orders')).rows[0].total_centavos, 500)
})

test('real hotel and catering prices are unchanged while the test item is ON', async () => {
  process.env.ALLOW_TEST_ITEM = 'true'
  process.env.TEST_ITEM_PESOS = '1'
  await post('/api/bookings', hotel({ hotelSlug: 'swiss-belhotel-blulane', roomId: 'sbb-suite' }))
  assert.equal(fake.checkouts[0].totalAmount.value, 8960) // 8000 + 12%
  await post('/api/catering-orders', catering({ packageId: 'handaan', guests: 50 }))
  assert.equal(fake.checkouts[1].totalAmount.value, 70000)
})

test('prototype-key lookups are rejected cleanly, not with a server error', async () => {
  assert.equal((await post('/api/bookings', hotel({ hotelSlug: '__proto__' }))).status, 400)
  assert.equal((await post('/api/bookings', hotel({ hotelSlug: 'swiss-belhotel-blulane', roomId: 'constructor' }))).status, 400)
  assert.equal((await post('/api/catering-orders', catering({ packageId: 'constructor' }))).status, 400)
})
