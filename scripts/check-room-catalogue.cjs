#!/usr/bin/env node
/**
 * Consistency check between src/data/hotels.js (what the frontend shows and
 * lets a customer select) and server/routes/bookings.js's CATALOGUE (what
 * the server will actually accept and price a booking for).
 *
 * These two have drifted out of sync before — a room existed in one file
 * but not the other, so bookings for it either silently failed (frontend
 * had a room the server didn't recognize) or could be requested for a room
 * invisible on the site (server had a phantom entry). This script catches
 * both directions before that reaches production.
 *
 * Uses plain regex extraction rather than importing both files, since
 * src/data/hotels.js is ESM and server/routes/bookings.js is CommonJS —
 * this avoids mixing module systems just to run a sanity check.
 *
 * Run manually: node scripts/check-room-catalogue.js
 * Exits 1 (and prints what's wrong) if anything is out of sync, so it's
 * also safe to wire into a pre-push hook or CI step later.
 */
const fs = require('fs')
const path = require('path')

const hotelsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'data', 'hotels.js'),
  'utf8',
)
const bookingsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'server', 'routes', 'bookings.js'),
  'utf8',
)

/** Extracts { slug -> [roomId, ...] } from the frontend hotels.js source. */
function extractFrontendRooms(source) {
  const result = {}
  // Split into per-hotel blocks on each `slug: '...'` occurrence.
  const hotelBlocks = source.split(/(?=slug: '[^']+')/g).slice(1)
  for (const block of hotelBlocks) {
    const slugMatch = block.match(/slug: '([^']+)'/)
    if (!slugMatch) continue
    const slug = slugMatch[1]
    // Stop at the next top-level hotel entry so we don't bleed into it.
    const roomsSectionMatch = block.match(/rooms:\s*\[([\s\S]*?)\n {2}\],/)
    const roomsSection = roomsSectionMatch ? roomsSectionMatch[1] : block
    const ids = [...roomsSection.matchAll(/id: '([^']+)'/g)].map((m) => m[1])
    result[slug] = ids
  }
  return result
}

/** Extracts { slug -> [roomId, ...] } from the server CATALOGUE object. */
function extractServerRooms(source) {
  const result = {}
  const catalogueMatch = source.match(/const CATALOGUE = \{([\s\S]*?)\n\}/)
  if (!catalogueMatch) {
    throw new Error('Could not find CATALOGUE in server/routes/bookings.js')
  }
  const body = catalogueMatch[1]
  const hotelBlocks = body.split(/(?=\n {2}'[a-z0-9-]+': \{)/g)
  for (const block of hotelBlocks) {
    const slugMatch = block.match(/'([a-z0-9-]+)': \{/)
    if (!slugMatch) continue
    const slug = slugMatch[1]
    const ids = [...block.matchAll(/'([a-z0-9-]+)': \{ name:/g)].map((m) => m[1])
    if (ids.length > 0) result[slug] = ids
  }
  return result
}

const frontend = extractFrontendRooms(hotelsSrc)
const server = extractServerRooms(bookingsSrc)

let hasError = false

const allSlugs = new Set([...Object.keys(frontend), ...Object.keys(server)])

for (const slug of allSlugs) {
  const frontendIds = new Set(frontend[slug] ?? [])
  const serverIds = new Set(server[slug] ?? [])

  const missingFromServer = [...frontendIds].filter((id) => !serverIds.has(id))
  const missingFromFrontend = [...serverIds].filter((id) => !frontendIds.has(id))

  if (!frontend[slug]) {
    console.error(`✗ ${slug}: exists in server CATALOGUE but not in src/data/hotels.js`)
    hasError = true
    continue
  }
  if (!server[slug]) {
    console.error(`✗ ${slug}: exists in src/data/hotels.js but not in server CATALOGUE`)
    hasError = true
    continue
  }

  if (missingFromServer.length > 0) {
    console.error(
      `✗ ${slug}: room(s) shown on the site but the server would reject the booking: ${missingFromServer.join(', ')}`,
    )
    hasError = true
  }
  if (missingFromFrontend.length > 0) {
    console.error(
      `✗ ${slug}: server accepts booking these room IDs, but they don't exist on the site (phantom rooms): ${missingFromFrontend.join(', ')}`,
    )
    hasError = true
  }
}

if (hasError) {
  console.error('\nFix: make src/data/hotels.js room ids and server/routes/bookings.js CATALOGUE room ids match exactly for every hotel.')
  process.exit(1)
} else {
  console.log(`✓ Room catalogue in sync across ${allSlugs.size} hotel(s).`)
}
