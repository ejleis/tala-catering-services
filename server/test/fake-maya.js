/**
 * LOCAL-ONLY stand-in for Maya, so the whole booking flow can be tried on your
 * machine without any real keys or money.
 *
 *   node test/fake-maya.js            (listens on http://localhost:4000)
 *
 * It implements only what lib/maya.js calls, plus a tiny "checkout page" with
 * Pay / Fail / Cancel buttons. Never deploy this and never set MAYA_API_BASE
 * on Render. The API only talks to it when BOTH of these are set in
 * server/.env:
 *     ALLOW_FAKE_MAYA=true
 *     MAYA_API_BASE=http://localhost:4000
 */
const http = require('node:http')

const PORT = Number(process.env.FAKE_MAYA_PORT ?? 4000)
const checkouts = new Map() // checkoutId -> { rrn, value, redirectUrl, status }

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const json = (code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  if (req.method === 'POST' && url.pathname === '/checkout/v1/checkouts') {
    if (!req.headers.authorization?.startsWith('Basic ')) return json(401, { code: 'unauthorized' })
    const body = JSON.parse((await readBody(req)) || '{}')
    const id = `fake-${Math.random().toString(36).slice(2, 10)}`
    checkouts.set(id, {
      rrn: body.requestReferenceNumber,
      value: body.totalAmount?.value,
      redirectUrl: body.redirectUrl,
      status: 'PENDING_PAYMENT',
    })
    console.log(`[fake-maya] checkout ${id} created for ${body.totalAmount?.value} ${body.totalAmount?.currency}`)
    return json(200, { checkoutId: id, redirectUrl: `http://localhost:${PORT}/checkout?id=${id}` })
  }

  if (req.method === 'GET' && url.pathname === '/checkout') {
    const c = checkouts.get(url.searchParams.get('id'))
    if (!c) return json(404, {})
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(`<!doctype html><meta charset="utf-8"><title>Fake Maya</title>
      <body style="font-family:sans-serif;max-width:420px;margin:60px auto;text-align:center">
      <p style="background:#fef3c7;padding:10px;border-radius:8px"><b>FAKE MAYA</b> — local testing only, no real money</p>
      <h2>Pay PHP ${esc(c.value)}</h2>
      <form method="post" action="/decide?id=${esc(url.searchParams.get('id'))}">
        <button name="result" value="pay" style="padding:12px 24px;margin:6px">Pay</button>
        <button name="result" value="fail" style="padding:12px 24px;margin:6px">Fail</button>
        <button name="result" value="cancel" style="padding:12px 24px;margin:6px">Cancel</button>
      </form></body>`)
  }

  if (req.method === 'POST' && url.pathname === '/decide') {
    const c = checkouts.get(url.searchParams.get('id'))
    if (!c) return json(404, {})
    const result = new URLSearchParams(await readBody(req)).get('result')
    c.status = { pay: 'PAYMENT_SUCCESS', fail: 'PAYMENT_FAILED', cancel: 'PAYMENT_CANCELLED' }[result] ?? c.status
    const target = { pay: c.redirectUrl.success, fail: c.redirectUrl.failure, cancel: c.redirectUrl.cancel }[result]
    console.log(`[fake-maya] ${url.searchParams.get('id')} -> ${c.status}`)
    res.writeHead(302, { Location: target })
    return res.end()
  }

  const rrn = req.method === 'GET' && url.pathname.match(/^\/payments\/v1\/payment-rrns\/(.+)$/)
  if (rrn) {
    if (!req.headers.authorization?.startsWith('Basic ')) return json(401, { code: 'unauthorized' })
    const ref = decodeURIComponent(rrn[1])
    const list = [...checkouts.entries()]
      .filter(([, c]) => c.rrn === ref)
      .map(([id, c]) => ({
        id,
        requestReferenceNumber: c.rrn,
        status: c.status,
        isPaid: c.status === 'PAYMENT_SUCCESS',
        receiptNumber: c.status === 'PAYMENT_SUCCESS' ? `FAKE-${id}` : null,
        amount: { value: String(c.value) },
        currency: 'PHP',
      }))
    return json(200, list)
  }

  return json(404, {})
})

server.listen(PORT, () => console.log(`Fake Maya listening on http://localhost:${PORT}`))
