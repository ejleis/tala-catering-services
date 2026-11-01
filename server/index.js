/**
 * API server for Tala's Event Catering Services.
 *
 *   POST /api/inquiries        — validate a catering inquiry and email the owner
 *   POST /api/bookings         — validate a hotel booking, store it, start Maya Checkout
 *   GET  /api/bookings/:id/status — payment status for the result pages
 *   POST /api/maya/webhook     — Maya payment notifications (verified server-side)
 */
require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const inquiriesRouter = require('./routes/inquiries')
const bookingsRouter = require('./routes/bookings')
const cateringRouter = require('./routes/catering')
const mayaRouter = require('./routes/maya')
const maya = require('./lib/maya')
const payments = require('./lib/payments')
const testItem = require('./lib/testItem')
const { getClientIp } = require('./lib/clientIp')

const app = express()

// Trust the first proxy hop so rate limiting sees real client IPs behind a
// load balancer / CDN. Set to the number of proxies actually in front of you.
app.set('trust proxy', 1)

// Security headers: CSP, HSTS, X-Content-Type-Options, frame protection, etc.
app.use(helmet())

// Do not advertise the framework.
app.disable('x-powered-by')

// Only the site's own origin may call this API from a browser.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map((value) => value.trim()) ?? false,
    methods: ['GET', 'POST'],
    maxAge: 86400,
  }),
)

// Cap body size — an unbounded JSON parser is a trivial denial-of-service.
app.use(express.json({ limit: '32kb' }))

// Maya's webhook is server-to-server: mounted before the browser-oriented
// global limiter below and protected by its own IP allow-list instead.
app.use('/api/maya', mayaRouter)

// Global throttle, with a tighter limit applied per-route below.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    message: { message: 'Too many requests. Please try again later.' },
  }),
)

app.use('/api/inquiries', inquiriesRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/catering-orders', cateringRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

// Central error handler — never leak stack traces to clients.
// body-parser errors carry the raw request body (err.body) and a client-error
// status; answer those with 400/413 and log only the type and status, never the body.
app.use((error, _req, res, _next) => {
  const status = Number(error?.status ?? error?.statusCode)
  if (error?.type === 'entity.too.large' || status === 413) {
    console.warn('[request] rejected: body too large (413)')
    return res.status(413).json({ message: 'The request is too large.' })
  }
  if (error?.type === 'entity.parse.failed' || error?.type === 'encoding.unsupported' || error?.type === 'charset.unsupported' || status === 400) {
    console.warn(`[request] rejected: ${String(error?.type ?? 'bad request').slice(0, 60)} (400)`)
    return res.status(400).json({ message: 'The request could not be read. Please check it and try again.' })
  }
  // Unknown failure: log the message only (never the request body), generic reply.
  console.error('[error]', error?.type ?? error?.name ?? 'Error', String(error?.message ?? '').slice(0, 300))
  return res.status(500).json({ message: 'Something went wrong. Please try again.' })
})

module.exports = app

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3001)
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`)
    console.log(
      maya.isEnabled()
        ? `Maya payments: ENABLED (${maya.environment()})`
        : 'Maya payments: DISABLED (set MAYA_ENVIRONMENT, MAYA_PUBLIC_KEY, MAYA_SECRET_KEY, FRONTEND_URL)',
    )
    if (testItem.testPesos() !== null) {
      console.warn(`WARNING: hidden TEST ITEM is ON at PHP ${testItem.testPesos()} — remove ALLOW_TEST_ITEM / TEST_ITEM_PESOS when testing is finished.`)
    }
    if (process.env.DATABASE_URL) payments.startSweeper()
  })
}
