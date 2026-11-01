# CLAUDE.md — Tala's Event Catering Services

Working notes for Claude on this repository: what the project is, how it is built, the decisions made so far, and the rules for working with Eli. Last updated 31 Oct 2026, from the build conversations up to 12 Oct 2026.

Never put secrets (API keys, database passwords, connection strings) in this file, in chat, or in git.

## 1. Project

- **Client:** Tala's Event Catering Services (catering inquiries/orders plus hotel bookings through partner hotels).
- **Developer:** Eli (part-time full-stack developer, Philippines, Asia/Manila).
- **Repo:** github.com/ejleis/tala-catering-services, `main` branch.
- **Live site:** https://www.tala-ecs.com (also tala-ecs.com).
- **Voice for client-facing text:** formal.

## 2. Working rules (follow these)

1. **Git pushes.** Claude may commit and push feature branches (any branch other than `main`) when Eli asks. Pushing to `main` needs Eli's explicit consent every time: directly, with a refspec such as `HEAD:main`, with `--all`/`--mirror`, or by merging a PR (`gh pr merge`). The guard hook stops and asks him to approve those. After a push to `main`, fetch `origin/main` and compare it with the tested version. Sub-agents never push; they report back to the main session.
2. **Keep scope tight.** Do only what was asked. If a change touches a part he did not mention (for example the hotel flow), say so and explain why.
3. **Never invent facts, numbers or claims.** Mark anything unconfirmed as `[NEEDS PROOF]`.
4. **Offer a few options first** when a request is open, then refine the one he picks.
5. **Build and test before delivering.** Run the server tests and `npm run build`; for UI changes check the page in a browser (mobile and desktop).
6. **Check against GitHub** at the start of a session: `git fetch origin`, then compare the current branch with its remote and with `origin/main`. Do not assume local files match what he pushed, and do not discard unpushed local work on a feature branch.
7. **Windows user.** He runs PowerShell, not bash: give PowerShell commands (`Select-String`, not `grep`).
8. **Security first.** No vulnerabilities, no secrets in chat. If he pastes a secret (screenshots included), tell him to rotate it.
9. **Always say which branch we are on.** Before changing files or running git commands, check with `git branch --show-current`, and start every reply that touches the repo with `Branch: <name>`. If the branch is `main` and the work is a change rather than a release, stop and suggest a feature branch before editing anything.

## 3. Stack and hosting

| Part | Technology | Host |
|---|---|---|
| Frontend | React 19, Vite 6, Tailwind v4, react-router-dom 7 | Vercel (deploys on push to `main`) |
| API | Express 4 (CommonJS) in `server/`, helmet, cors (GET/POST), express-rate-limit | Render free tier, https://tala-catering-api.onrender.com |
| Database | Supabase Postgres, project "tala-catering" (ap-southeast-2), via `pg` and the Session pooler `DATABASE_URL` | Supabase |
| Email | Resend HTTP API (not SMTP: Render's free tier blocks SMTP) | Resend |
| Payments | Maya Checkout (hosted redirect), PRODUCTION, no sandbox | Maya |
| Domain / DNS | tala-ecs.com | Hostinger DNS, pointed at Vercel |

Render's free tier has cold starts.

## 4. Product decisions

- **Catering:** Kasalo (₱1,100/guest) and Handaan (₱1,400/guest), minimum 50 guests, show an always-visible calculator (price × guests × days) and a **Checkout** button leading to `/checkout`. Bespoke stays inquiry-only.
- **Catering payment:** online through Maya, either the **full amount** or a **down payment of any amount** the customer types, from the minimum up to the order total. The minimum is `CATERING_MIN_PAYMENT_PESOS` (default ₱1: a real ₱1.00 down payment was accepted by Maya on 1 Nov 2026; whether ₱1 is an acceptable business minimum is the client's call `[NEEDS PROOF]`). There is one Maya payment per order; the **balance is settled directly with Tala** offline (wording `[NEEDS PROOF]`). Hotels still pay in full. The cancellation/refund line under the Pay button is a **neutral placeholder** pending the client's real policy `[NEEDS PROOF]`.
- **Mobile Checkout layout:** on mobile the order summary comes first and **Pay with Maya** sits below it; desktop keeps the button at the bottom of the details card.
- **Hotels:** three partner hotels, one room each: Swiss-Belhotel Blulane (Executive One-Bedroom Suite, ₱8,000/night), Bay Area Suites Manila (Superior One Bedroom Suite, ₱5,238/night), Red Hotel Cubao (Executive Suite, ₱6,533/night). Hotel rates, availability and ratings are placeholders until each property confirms in writing `[NEEDS PROOF]`.
- **Tax:** the server adds a placeholder 12% to hotel bookings (`TAX_RATE`, default 0.12) `[NEEDS PROOF]`. It is duplicated as `TAX_RATE = 0.12` in `src/components/hotels/BookingSummary.jsx` and the two must stay in sync. Catering totals carry no tax line.
- **Production without a sandbox:** the client decided to go live on Maya production without a sandbox because of the deadline. Eli accepted the risk.
- **No availability or double-booking check** exists for hotels yet.

## 5. Architecture and trust model

- **Prices are never trusted from the browser.** The server has its own price lists: `CATALOGUE` in `server/routes/bookings.js` and `PACKAGES` in `server/routes/catering.js`. They must match `src/data/hotels.js` and `src/data/catering.js`. After touching hotel data run `npm run check:rooms` (room IDs have drifted before).
- **Only `reconcile()` confirms anything.** Webhooks, redirect URLs and the browser are hints: the server asks Maya (secret key, by our reference number) and compares reference, amount and currency with the database. Hotel logic is in `server/lib/payments.js`, catering logic in `server/lib/cateringPayments.js`. All of it is idempotent. For catering, the amount compared is `amount_due_centavos` (the full total or the down payment, computed by the server from `paymentOption`/`amountPesos`), not `total_centavos`; `payment_type` is `FULL` or `DEPOSIT`.
- **Money is whole centavos** end to end; Maya receives pesos.
- **Flows:**
  - Hotel: `POST /api/bookings` → Maya checkout URL → `GET /api/bookings/:id/status` (the result page polls it).
  - Catering: `POST /api/catering-orders` → Maya checkout URL → `GET /api/catering-orders/:id/status`.
  - Return URLs are `/payment/success|failure|cancel?b=<uuid>`, with `&k=catering` for catering orders. The result page is display-only.
- **Webhook:** `POST /api/maya/webhook`, one URL for both flows. Maya's webhooks are unsigned, so the route checks Maya's published IPs (production 18.138.50.235, 3.1.207.200) through the `True-Client-IP` header (`CLIENT_IP_HEADER`), replies 200, stores a `webhook_events` row, then reconciles. The route routes a reference to a catering order if one exists, otherwise to a hotel booking.
- **Background sweep (every 5 minutes):** unpaid bookings and orders are re-checked with Maya 3 minutes after creation; unpaid ones expire after the 60-minute checkout window plus 10 minutes; failed confirmation emails are retried (up to 5 times). The webhook is proven to work (section 9); the sweep stays as the safety net for any delivery Maya misses.
- **Safety switch:** `POST /api/bookings` and `/api/catering-orders` return 503 unless `MAYA_ENVIRONMENT` (exactly `sandbox` or `production`), `MAYA_PUBLIC_KEY`, `MAYA_SECRET_KEY`, `FRONTEND_URL` and `DATABASE_URL` are all set. Clearing `MAYA_ENVIRONMENT` on Render is the kill switch.
- **Database:** `server/db/schema.sql` (bookings, payments, webhook_events) and `server/db/catering-orders.sql` (catering_orders). Row-level security is on with no policies; the API connects with the postgres role. One booking can have only one PAID payment (partial unique index).
- **Emails:** owner and customer confirmation emails are sent only after verified payment. Owner alerts are sent for amount mismatches and late payments.

## 6. Environment variables (names only; values live on Render/Vercel)

Server (Render): `DATABASE_URL`, `DATABASE_CA_CERT` (optional), `MAYA_ENVIRONMENT=production`, `MAYA_PUBLIC_KEY`, `MAYA_SECRET_KEY`, `FRONTEND_URL=https://www.tala-ecs.com`, `CLIENT_IP_HEADER=true-client-ip`, `MAYA_WEBHOOK_IPS` (optional override), `TAX_RATE`, `CATERING_MIN_PAYMENT_PESOS` (optional, default 1; if changed, also change `MIN_ONLINE_PAYMENT_PESOS` in `src/data/catering.js`, which the checkout's client-side "at least ₱X" error uses; the hint under the amount box shows only the maximum), `CORS_ORIGIN`, `RESEND_API_KEY`, `MAIL_FROM`, `OWNER_EMAIL`, `PORT`.

Frontend (Vercel): `VITE_API_BASE_URL` where the API is on another host.

**Never set on Render:** `MAYA_API_BASE` and `ALLOW_FAKE_MAYA` (they redirect Maya calls to a local fake server and exist only for local testing; `MAYA_API_BASE` is ignored unless `ALLOW_FAKE_MAYA=true`).

## 7. Testing

- **Server tests:** `cd server && TEST_DATABASE_URL=postgresql://... npm test` (Node `node:test`, 34 tests, run serially). They use a fake Maya server and a real Postgres with both SQL files applied. They prove our logic, not Maya's real responses.
- **Local fake Maya:** `npm run fake-maya` in `server/`, with `ALLOW_FAKE_MAYA=true` and `MAYA_API_BASE=http://localhost:4000` in `server/.env`.
- **Frontend:** `npm run build`; `npm run check:rooms`.
- **Pitfall for Claude's own shell:** `pkill -f <pattern>` can match and kill the shell running it. Kill by PID instead.

## 8. Live testing without a sandbox: the hidden test item

Off by default. To use it, set BOTH on Render: `ALLOW_TEST_ITEM=true` and `TEST_ITEM_PESOS=1` (a number from 1 to 100, two decimals at most). It adds hotel `test-hotel` / `test-room` and catering package `test`, never shown on the website, priced only from `TEST_ITEM_PESOS`; the API log prints a warning while it is on. Order it with a direct request (PowerShell `Invoke-RestMethod` to `/api/bookings` or `/api/catering-orders`), open the returned `checkoutUrl`, pay, then **void the payment in Maya Manager the same day** (before midnight Manila time). A hotel test total is the price plus the 12% placeholder tax (₱1 → ₱1.12). **Afterwards delete both variables and remove only the test rows** with the targeted deletes in the `/payment-test-runbook` skill (step 8). Never `truncate` the tables once the site has taken a real order: it deletes real customers' orders too. Eli runs all of this himself; Claude never creates production orders or runs SQL against production.

## 9. Maya facts and open problems

- **Minimum payment:** Maya's docs state none, but a real ₱1.00 payment (a catering down payment) was accepted, confirmed and voided on 1 Nov 2026, so ₱1 works in production. Maya's fee on very small payments is still unknown `[NEEDS PROOF]`, and the business minimum for down payments is the client's decision. Claude never creates production checkouts; Eli runs `/payment-test-runbook`.
- Void: same day only, full amount, before midnight (GMT+8); refunds from the next day, up to 180 days. Void and Refund must be enabled on the account through the Maya Relationship Manager.
- **Webhook delivery works (resolved 1 Nov 2026):** in the live paid test, Maya's webhook arrived from 18.138.50.235 and the order was confirmed 0.7 s later; Maya had also delivered `PAYMENT_EXPIRED` webhooks on 29 Oct from 18.138.50.235 and 3.1.207.200. Maya's own webhook "Test" button still fails with `getaddrinfo: Name or service not known` (even for `https://webhook.site/...`): that is a fault in Maya's tester, not in delivery, so there is nothing to raise with Maya support. How to read `webhook_events`: a row **with `source_ip` set** is a Maya delivery; a row with an empty `source_ip` and `verified = true` is the server's own reconcile audit row and appears even when no webhook arrived.
- Maya's payment-lookup response fields are not documented in detail; the code reads status and amount defensively and fails closed (no confirmation, owner alert, audit row).
- The payments go to the merchant account that issued the API keys (merchant `TALAS ECS (PHP)`). Confirm that this organization belongs to the client and not to Eli personally.

## 10. Open items and live status

Kept in `CLAUDE.local.md` (local only, gitignored, loaded automatically by Claude Code), because this repo is public: key-rotation status, the live Render settings, and test progress do not belong in it. Product items that are safe to publish:

- **Client must confirm:** Kasalo and Handaan rates (placeholders `[NEEDS PROOF]`), real hotel rates and tax treatment, the cancellation/refund wording, the down-payment balance wording, and whether ₱1 is an acceptable minimum down payment.
- **Down-payment deploy order:** re-run `server/db/catering-orders.sql` in Supabase (it adds `payment_type` and `amount_due_centavos`) **before** the down-payment code reaches `main`; otherwise new catering orders fail.
- Optional Supabase fix: `alter function public.set_updated_at() set search_path = '';` (advisor warning, not applied).

## 11. Delivery history (all on `main`)

Hotel booking and Maya Checkout integration (`8982924`), webhook router mounted and fake-Maya hardening (`d008a5a`), catering payments and faster verification of unpaid payments (`b00defa`), mobile checkout layout (`b7384df`), hidden test item (`3d93955`). Earlier: catering checkout flow with always-on calculators, real hotel photos, one room per hotel, room-ID sync check.

## 12. Findings from the 31 Oct 2026 repo review (verified in code)

- `.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main`, while production is on Vercel. Decide whether to keep or remove it.
- **`vercel.json` (added 1 Nov 2026):** rewrites every path to `/index.html` (before this, deep links such as Maya's return URL `/payment/success?b=…` hit the leftover GitHub Pages `public/404.html` and looped forever), and sends the security headers: CSP (`connect-src` allows only the site and https://tala-catering-api.onrender.com; fonts from Google, images from images.unsplash.com; `frame-ancestors 'none'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. HSTS comes from Vercel. **If you add a new external host (images, fonts, scripts, APIs), add it to the CSP or it will be blocked.** No `render.yaml` yet.
- `npm run lint` exists but ESLint is not installed or configured.
- `DATABASE_CA_CERT` is optional, so the database connection can be encrypted but unverified.

## 13. Sub-agents (`.claude/agents/`)

- `tala-project-manager`: plans, delegates, verifies, tracks the board in `docs/PM-BOARD.md`. Start multi-part work here.
- `tala-frontend-engineer`: `src/`, `public/`, Vite and Tailwind.
- `tala-backend-engineer`: `server/`, SQL, payment logic, tests.
- `tala-deployment-engineer`: Vercel, Render, GitHub Actions, env vars, headers, DNS.
- `tala-devops-security`: read-only audits; reports findings, never edits.

All agents follow section 2 (working rules). Sub-agents never push; the main session pushes under rule 1.

## 14. Skills and hook (`.claude/`)

- `/release-check` (skills/release-check): pre-release gate. Runs build, catalogue and rate sync, audit and secret checks, then lists what only Eli can confirm. Note: `npm run check:rooms` checks room IDs only; prices and `TAX_RATE` are compared by hand.
- `/payment-test-runbook` (skills/payment-test-runbook): guided real-payment test with the hidden test item, same-day void and cleanup. User-invoked only. Eli runs every request; Claude never calls the production order routes. Cleanup uses targeted deletes, because a `truncate` would also delete real orders once the site has any.
- `hooks/guard.cjs`, wired in `settings.json` (which also has `permissions.deny` rules for real env files). Best-effort text matching, not a sandbox. Tests: `node --test .claude/hooks/guard.test.cjs`.
  - **Blocks:** reading, searching or editing real `.env` files (`.env.example` is allowed), including wildcards such as `.e*`, recursive `grep`/`findstr`, `rg --hidden`/`--no-ignore`, PowerShell recursive or wildcard searches, and `dotenv` used to print values. Also blocks requests to the production API host that name an order, payment or inquiry route, and any push from a sub-agent.
  - **Asks Eli:** any push that could update `main` (a refspec naming `main`, `HEAD:main` or `@:main`, `--all`/`--mirror`, a bare push while on or tracking `main`, a push after switching branch or folder in the same command, git config that changes push targets, nested shells, and anything it cannot read); `gh pr merge` and merges through `gh api`; edits to `.claude/hooks/` or `.claude/settings*.json`; Supabase connector calls that are not read-only.
  - **Allows:** pushes to other branches, and everything else.
  - Recursive search over the repo: use Claude's Grep tool, which skips gitignored and hidden files.
