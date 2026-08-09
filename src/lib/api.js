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
 * Submits a hotel booking request.
 *
 * While the client's Maya Business account is still being set up, the server
 * records the booking as PENDING_PAYMENT and notifies the owner. Once Maya is
 * live, the same endpoint will additionally return a `checkoutUrl` created
 * server-side, and the caller should redirect the browser to it.
 */
export function submitBooking(values, { signal } = {}) {
  return request('/api/bookings', { body: values, signal })
}

export { ApiError }
