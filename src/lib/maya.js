/**
 * The server returns the Maya checkout URL, which is our own server's word,
 * but a browser redirect is cheap to constrain, so we only ever follow
 * HTTPS links on Maya's own domains.
 */
export function isMayaCheckoutUrl(value) {
  try {
    const url = new URL(value)
    // Local testing only: Vite sets DEV false in production builds, so this
    // exception cannot exist on the live site.
    if (import.meta.env.DEV && url.hostname === 'localhost') return true
    return url.protocol === 'https:' && /(^|\.)(paymaya\.com|maya\.ph)$/.test(url.hostname)
  } catch {
    return false
  }
}
