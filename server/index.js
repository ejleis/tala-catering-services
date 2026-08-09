/**
 * Reference API server for Tala's Event Catering Services.
 *
 * Responsibilities:
 *   POST /api/inquiries  — validate a catering inquiry and email the owner
 *   POST /api/bookings   — validate a hotel booking request and email the owner
 *   POST /api/maya/webhook — (stub) server-side payment verification
 *
 * This is intentionally storage-agnostic: swap the in-memory record keeping for
 * your database of choice. What it demonstrates is the security posture.
 */
require('dotenv').config()

const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const inquiriesRouter = require('./routes/inquiries')
const bookingsRouter = require('./routes/bookings')

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
    methods: ['POST'],
    maxAge: 86400,
  }),
)

// Cap body size — an unbounded JSON parser is a trivial denial-of-service.
app.use(express.json({ limit: '32kb' }))

// Global throttle, with a tighter limit applied per-route below.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' },
  }),
)

app.use('/api/inquiries', inquiriesRouter)
app.use('/api/bookings', bookingsRouter)

app.get('/health', (_req, res) => res.json({ ok: true }))

// Central error handler — never leak stack traces to clients.
app.use((error, _req, res, _next) => {
  console.error('[error]', error)
  res.status(500).json({ message: 'Something went wrong. Please try again.' })
})

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
