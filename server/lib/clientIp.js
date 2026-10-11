/**
 * Real client IP behind Render's proxy chain.
 *
 * X-Forwarded-For can be forged by the caller (its leftmost entries are
 * whatever the client sent), so it must NOT be used for allow-lists or
 * rate-limit keys. Render sets the `True-Client-IP` header itself, so when
 * CLIENT_IP_HEADER=true-client-ip is configured we trust that header. If
 * it is not configured we fall back to Express's `req.ip`, which keeps the
 * previous behaviour.
 *
 * Only set CLIENT_IP_HEADER to a header your hosting platform overwrites.
 */
function getClientIp(req) {
  const headerName = (process.env.CLIENT_IP_HEADER || '').trim().toLowerCase()
  if (headerName) {
    const value = req.get(headerName)
    if (typeof value === 'string' && value.trim()) return value.trim().split(',')[0].trim()
  }
  return req.ip || ''
}

module.exports = { getClientIp }
