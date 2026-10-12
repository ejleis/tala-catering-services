/**
 * Hidden low-price test item, for trying a REAL Maya payment cheaply while no
 * Maya sandbox exists.
 *
 * It is OFF unless BOTH are set on the server:
 *     ALLOW_TEST_ITEM=true
 *     TEST_ITEM_PESOS=1            (a number from 1 to 100, two decimals at most)
 *
 * When on, the server price lists gain one item each — hotel "test-hotel" /
 * "test-room" and catering package "test". The website never shows them;
 * they can only be ordered by sending the request directly. The price comes
 * from this variable on the server, never from the request. Remove the
 * variables on Render when the testing is done.
 */
const MIN_PESOS = 1
const MAX_PESOS = 100

/** Returns the configured test price in pesos, or null when the test item is off or misconfigured. */
function testPesos() {
  if (process.env.ALLOW_TEST_ITEM !== 'true') return null
  const raw = (process.env.TEST_ITEM_PESOS ?? '').trim()
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw)) return null
  const value = Number(raw)
  return value >= MIN_PESOS && value <= MAX_PESOS ? value : null
}

module.exports = { testPesos }
