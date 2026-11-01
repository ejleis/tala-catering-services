/**
 * Tests that need no database: input validation, the inquiry acknowledgement
 * email, and the central error handler. Always run (no TEST_DATABASE_URL needed).
 */
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')

Object.assign(process.env, {
  RESEND_API_KEY: 're_test',
  MAIL_FROM: 'test@example.com',
  OWNER_EMAIL: 'owner@example.com',
  CLIENT_IP_HEADER: 'true-client-ip',
  CORS_ORIGIN: 'https://www.tala-ecs.com',
})

const { int, isValidDate, isFutureDate, manilaToday, validateBooking, validateInquiry } = require('../lib/validation')
const mailer = require('../lib/mailer')

// ---- int() ---------------------------------------------------------------
test('int() accepts only real integers or digit-only strings within limits', () => {
  const lim = { min: 1, max: 2000 }
  assert.equal(int(60, lim), 60)
  assert.equal(int('60', lim), 60)
  assert.equal(int(' 60 ', lim), 60)
  assert.equal(int('007', lim), 7)
  for (const bad of [['60abc'], '60abc', '1.9e5', '1e3', '1.5', 1.5, '-3', -3, '+5', '0x10', '', ' ', null, undefined, {}, [], ['60'], true, NaN, Infinity, '0', 0, 2001, '2001', '99999999999999999999']) {
    assert.equal(int(bad, lim), null, `should reject ${JSON.stringify(bad)}`)
  }
  assert.equal(validateBooking({ guests: ['60abc'], rooms: '1.9e5' }).data.guests, null)
  assert.equal(validateBooking({ guests: '2', rooms: 1 }).data.guests, 2)
  assert.equal(validateInquiry({ guestCount: '1.9e5' }).data.guestCount, null)
})

// ---- dates ---------------------------------------------------------------
test('isValidDate() rejects impossible calendar dates', () => {
  assert.equal(isValidDate('2027-02-28'), true)
  assert.equal(isValidDate('2028-02-29'), true) // leap year
  for (const bad of ['2027-02-30', '2027-02-29', '2027-13-01', '2027-00-10', '2027-04-31', '2027-1-1', '27-01-01', '', null, 20270101, ['2027-01-01']]) {
    assert.equal(isValidDate(bad), false, `should reject ${JSON.stringify(bad)}`)
  }
})

test('"today" is the Asia/Manila calendar date, not the UTC date', () => {
  // 17:00 UTC on 1 March is 01:00 on 2 March in Manila (UTC+8).
  const lateUtc = new Date('2027-03-01T17:00:00Z')
  assert.equal(manilaToday(lateUtc), '2027-03-02')
  assert.equal(isFutureDate('2027-03-01', lateUtc), false) // already yesterday in Manila
  assert.equal(isFutureDate('2027-03-02', lateUtc), true)
  // 15:59 UTC is still 23:59 on the same day in Manila.
  const earlyUtc = new Date('2027-03-01T15:59:00Z')
  assert.equal(manilaToday(earlyUtc), '2027-03-01')
  assert.equal(isFutureDate('2027-03-01', earlyUtc), true)
  assert.equal(isFutureDate('2027-02-28', earlyUtc), false)
  assert.equal(isFutureDate('2027-02-30', earlyUtc), false)
  // Real clock: today (Manila) is accepted, yesterday is not.
  assert.equal(isFutureDate(manilaToday()), true)
})

// ---- inquiry acknowledgement ---------------------------------------------
test('the customer acknowledgement is fixed text and contains no user-supplied text', async () => {
  const html = mailer.buildInquiryAcknowledgementHtml()
  assert.equal(typeof html, 'string')
  assert.equal(html, mailer.buildInquiryAcknowledgementHtml()) // takes no input

  const realFetch = globalThis.fetch
  const sent = []
  globalThis.fetch = async (_url, init) => {
    sent.push(JSON.parse(init.body))
    return new Response(JSON.stringify({ id: 'email-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    await mailer.sendInquiryAcknowledgement({
      name: 'EVIL_NAME_MARKER', eventType: 'EVIL_EVENT_MARKER', message: 'EVIL_MESSAGE_MARKER',
      eventDate: '2099-01-01', guestCount: 777123, venue: 'EVIL_VENUE_MARKER', phone: '0917 000 0000',
      packageId: 'EVIL_PACKAGE_MARKER', menuInterest: ['EVIL_MENU_MARKER'], email: 'victim@example.com',
    })
  } finally {
    globalThis.fetch = realFetch
  }
  assert.equal(sent.length, 1)
  const wire = JSON.stringify(sent[0])
  assert.doesNotMatch(wire, /EVIL_|777123|2099-01-01|0917/)
  assert.deepEqual([sent[0].to].flat(), ['victim@example.com'])
  assert.equal(sent[0].subject, "We received your inquiry — Tala's Event Catering Services")
  assert.equal(sent[0].html, html)
})

// ---- error handler ---------------------------------------------------------
let server, base
const logs = []
const realConsole = { log: console.log, warn: console.warn, error: console.error }

before(async () => {
  const app = require('../index.js')
  server = http.createServer(app)
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(() => server.close())

let ip = 0
async function postRaw(path, raw) {
  logs.length = 0
  for (const level of ['log', 'warn', 'error']) console[level] = (...args) => logs.push(args.map((a) => (a instanceof Error ? `${a.stack}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'True-Client-IP': `198.51.100.${(ip += 1)}` },
      body: raw,
    })
    return { status: res.status, text: await res.text() }
  } finally {
    Object.assign(console, realConsole)
  }
}

test('malformed JSON gets 400 with a generic message and the body is never logged', async () => {
  const { status, text } = await postRaw('/api/inquiries', '{"name": "BODY_SECRET_MARKER", ')
  assert.equal(status, 400)
  assert.doesNotMatch(text, /BODY_SECRET_MARKER|SyntaxError|at /)
  assert.ok(JSON.parse(text).message)
  assert.doesNotMatch(logs.join('\n'), /BODY_SECRET_MARKER/)
})

test('an oversized body gets 413 and the body is never logged', async () => {
  const big = JSON.stringify({ message: `BODY_SECRET_MARKER${'x'.repeat(40 * 1024)}` })
  const { status, text } = await postRaw('/api/inquiries', big)
  assert.equal(status, 413)
  assert.doesNotMatch(text, /BODY_SECRET_MARKER/)
  assert.doesNotMatch(logs.join('\n'), /BODY_SECRET_MARKER/)
})

test('an unexpected failure is a generic 500: no stack trace to the client, no body in the log', async () => {
  const realFetch = globalThis.fetch
  // Let the test's own request through, but make the outbound Resend call fail.
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('resend')) throw new Error('simulated mail outage')
    return realFetch(url, init)
  }
  try {
    const body = JSON.stringify({
      name: 'BODY_SECRET_MARKER', email: 'a@example.com', phone: '0917 123 4567',
      eventType: 'Wedding', eventDate: '2099-01-01', guestCount: 80,
    })
    const { status, text } = await postRaw('/api/inquiries', body)
    assert.equal(status, 500)
    assert.deepEqual(JSON.parse(text), { message: 'Something went wrong. Please try again.' })
    assert.doesNotMatch(logs.join('\n'), /BODY_SECRET_MARKER/)
  } finally {
    globalThis.fetch = realFetch
  }
})
