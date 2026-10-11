/**
 * API client.
 *
 * SECURITY NOTES
 * - This module talks only to YOUR backend. It never calls Maya, an email
 *   provider, or any third party directly, because doing so would require
 *   shipping a secret key to the browser.
 * - No API keys, tokens, or credentials appear anywhere in this file.
 * - Responses are treated as untrusted data and are never rendered as HTML.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

class ApiError extends Error {
  constructor(message, status, fieldErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors ?? {}
  }
}

async function request(path, { method = 'POST', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      // 'same-origin' keeps cookies from being sent cross-site, limiting CSRF
      // exposure if this API is ever moved behind a cookie-authenticated host.
      credentials: 'same-origin',
      signal,
    })
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause
    throw new ApiError(
      'We could not reach the server. Please check your connection and try again.',
      0,
    )
  }

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message ?? 'Something went wrong. Please try again.',
      response.status,
      payload?.errors,
    )
  }

  return payload
}

/** Submits a catering inquiry. The server emails the business owner. */
export function submitInquiry(values, { signal } = {}) {
  return request('/api/inquiries', { body: values, signal })
}

/**
 * Submits a hotel booking. The server stores it as PENDING_PAYMENT, creates a
 * Maya Checkout session and returns `checkoutUrl`, which the caller redirects
 * the browser to. A booking is only ever confirmed by the server after Maya
 * verifies the payment.
 */
export function submitBooking(values, { signal } = {}) {
  return request('/api/bookings', { body: values, signal })
}

/** Payment status for a booking (display only — the server decides the truth). */
export function getBookingStatus(bookingId, { signal } = {}) {
  return request(`/api/bookings/${encodeURIComponent(bookingId)}/status`, { method: 'GET', signal })
}

export { ApiError }
