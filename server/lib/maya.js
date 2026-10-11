/**
 * Maya Checkout client (server-side only).
 *
 * - Create Checkout uses the PUBLIC key; payment look-ups use the SECRET key
 *   (per Maya's API reference). Both are sent as HTTP Basic auth:
 *   base64("<key>:").
 * - Keys come from environment variables and are never logged or returned.
 * - Hosts: sandbox https://pg-sandbox.paymaya.com, production
 *   https://pg.maya.ph. MAYA_ENVIRONMENT must be set explicitly to
 *   "sandbox" or "production"; anything else disables online payment.
 */
const HOSTS = {
  sandbox: 'https://pg-sandbox.paymaya.com',
  production: 'https://pg.maya.ph',
}

function environment() {
  const value = (process.env.MAYA_ENVIRONMENT || '').trim().toLowerCase()
  return value in HOSTS ? value : null
}

function baseUrl() {
  // MAYA_API_BASE exists only so automated tests can point at a fake server.
  return process.env.MAYA_API_BASE || HOSTS[environment()]
}

function isEnabled() {
  return Boolean(
    environment() &&
      process.env.MAYA_PUBLIC_KEY &&
      process.env.MAYA_SECRET_KEY &&
      process.env.FRONTEND_URL,
  )
}

function authHeader(key) {
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

async function call(method, path, key, body) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: authHeader(key),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    // Status + Maya's own error code only — never the request headers/keys.
    const error = new Error(`Maya ${method} ${path.split('?')[0]} failed with HTTP ${response.status}`)
    error.status = response.status
    error.mayaCode = payload?.code ?? null
    throw error
  }
  return payload
}

/** Maya wants peso amounts as numbers, e.g. 18240.5 — we store centavos. */
const pesos = (centavos) => Number((centavos / 100).toFixed(2))

function isMayaHost(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && /(^|\.)(paymaya\.com|maya\.ph)$/.test(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Creates a hosted checkout. `bookingId` becomes Maya's
 * requestReferenceNumber (a UUID, 36 chars — Maya's maximum).
 */
async function createCheckout({ bookingId, totalCentavos }) {
  const front = process.env.FRONTEND_URL.replace(/\/+$/, '')
  const ref = encodeURIComponent(bookingId)
  const result = await call('POST', '/checkout/v1/checkouts', process.env.MAYA_PUBLIC_KEY, {
    totalAmount: { value: pesos(totalCentavos), currency: 'PHP' },
    requestReferenceNumber: bookingId,
    redirectUrl: {
      success: `${front}/payment/success?b=${ref}`,
      failure: `${front}/payment/failure?b=${ref}`,
      cancel: `${front}/payment/cancel?b=${ref}`,
    },
  })

  if (!result?.checkoutId || !result?.redirectUrl) throw new Error('Maya returned an incomplete checkout response')
  // The browser will be sent to this URL, so only follow it if it is HTTPS on a Maya domain.
  if (!process.env.MAYA_API_BASE && !isMayaHost(result.redirectUrl)) {
    throw new Error('Maya returned an unexpected checkout host')
  }
  return { checkoutId: String(result.checkoutId), redirectUrl: result.redirectUrl }
}

/** Looks payments up by OUR reference. Maya answers with an array. */
async function getPaymentsByReference(requestReferenceNumber) {
  const list = await call(
    'GET',
    `/payments/v1/payment-rrns/${encodeURIComponent(requestReferenceNumber)}`,
    process.env.MAYA_SECRET_KEY,
  )
  return Array.isArray(list) ? list : list ? [list] : []
}

module.exports = { isEnabled, environment, createCheckout, getPaymentsByReference, pesos }
