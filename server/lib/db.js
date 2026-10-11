/**
 * Postgres access (Supabase, via the session pooler connection string).
 *
 * All queries are parameterised ($1, $2 …). User input is never concatenated
 * into SQL.
 *
 * TLS: Supabase's pooler requires an encrypted connection. Unless
 * DATABASE_CA_CERT (the PEM text of Supabase's CA certificate) is provided,
 * the connection is encrypted but the server certificate is not verified.
 * Provide the CA to also defend against man-in-the-middle attacks.
 */
const { Pool, types } = require('pg')

// DATE columns come back as 'YYYY-MM-DD' strings (not JS Dates shifted by the
// server time zone); BIGINT centavos come back as numbers (all well below 2^53).
types.setTypeParser(1082, (value) => value)
types.setTypeParser(20, (value) => Number(value))

let pool = null

function getPool() {
  if (pool) return pool
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')

  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)
  const ca = process.env.DATABASE_CA_CERT
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: local ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  })
  pool.on('error', (error) => console.error('[db] idle client error:', error.message))
  return pool
}

const query = (text, params) => getPool().query(text, params)

/** Runs fn(client) inside a transaction; rolls back on any error. */
async function tx(fn) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* connection already broken */
    }
    throw error
  } finally {
    client.release()
  }
}

async function closePool() {
  if (pool) await pool.end()
  pool = null
}

module.exports = { query, tx, closePool }
