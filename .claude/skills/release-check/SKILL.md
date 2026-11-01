---
name: release-check
description: Pre-release gate for Tala's site. Runs the build, catalogue and rate sync, dependency audit and secret checks locally, then lists what only Eli can confirm on Vercel, Render, Supabase and Maya.
when_to_use: Eli asks if the site is ready to release, or wants a check before pushing to main or after a deploy.
disable-model-invocation: true
---

# Release check

You are the release gate for Tala's Event Catering Services. This site takes real Maya payments in production, so report only what you verified. Never push to `main` without Eli's explicit consent, never call the production API, never touch a real database, never read `.env` files (a hook blocks these). If a secret shows up anywhere, do not repeat it; tell Eli to rotate it.

Use whichever shell tool is available. The commands below work in PowerShell and Bash.

## 1. Automated checks (you run these locally)

1. **Baseline.** `git status --short`, then `git fetch origin main`, then compare `git rev-parse HEAD` with `git rev-parse origin/main`. Report whether the tested commit is what is on `origin/main`, and list uncommitted files.
2. **Build.** If `node_modules` is missing run `npm ci`. Then `npm run build`. It must pass.
3. **Room catalogue.** `npm run check:rooms`. It checks room IDs only. It does not check prices.
4. **Rates and tax (manual compare, not covered by any script).** Read both sides and compare the numbers:
   - hotel nightly rates in `src/data/hotels.js` against `CATALOGUE` in `server/routes/bookings.js`;
   - catering rates in `src/data/catering.js` against `PACKAGES` in `server/routes/catering.js`;
   - `TAX_RATE` in `src/components/hotels/BookingSummary.jsx` against the server default in `taxRate()` in `server/routes/bookings.js`. The Render `TAX_RATE` variable overrides the server default, so list this under section 2 as well.
5. **Server syntax.** Run `node --check` on every file in `server/routes` and `server/lib`.
6. **Server tests.** Run `cd server && npm test` only if Eli gave you a `TEST_DATABASE_URL` for a disposable database in this session. Never use `DATABASE_URL`. Otherwise report NOT RUN and say why.
7. **Dependencies.** `npm audit --audit-level=moderate` in the repo root and in `server/`. Report each finding with its real exploitability, not just the count. Do not run `npm audit fix`.
8. **Secrets.** Search tracked files and git history for key-like strings (`postgres://`, `MAYA`, `RESEND`, `BEGIN PRIVATE KEY`, long random tokens). Use `gitleaks` if installed. Report file and line only, with no values.
9. **Config gaps.** Report whether `vercel.json` (security headers) and `render.yaml` exist, whether `.github/workflows/deploy.yml` still deploys to GitHub Pages while production is on Vercel, and whether `.env.example` and `server/.env.example` list every variable the code reads.
10. **Independent review.** If any of these changed since `origin/main`, ask the `tala-devops-security` agent to review the diff before you give a verdict: `server/lib/payments.js`, `server/lib/cateringPayments.js`, `server/lib/maya.js`, `server/routes/maya.js`, `server/lib/validation.js`, `server/index.js`, `server/lib/clientIp.js`.

## 2. Owner confirmations (you cannot verify these; ask Eli yes or no for each)

- Render: `MAYA_ENVIRONMENT=production`; `CLIENT_IP_HEADER=true-client-ip`; `CORS_ORIGIN` lists the exact live origins; `TAX_RATE` matches the front-end value.
- Render: `ALLOW_TEST_ITEM` and `TEST_ITEM_PESOS` are absent, unless a paid test is in progress. `MAYA_API_BASE` and `ALLOW_FAKE_MAYA` are never set.
- Render log shows `Maya payments: ENABLED (production)` and no `hidden TEST ITEM is ON` warning.
- Vercel: `VITE_API_BASE_URL` points at the Render API.
- Supabase: `server/db/schema.sql` and `server/db/catering-orders.sql` have both been run.
- The Maya secret key and the Supabase database password exposed earlier in chat have been rotated.
- Maya: Void and Refund are enabled on the account.
- Client has confirmed in writing: Kasalo and Handaan rates, hotel rates and tax treatment, and the cancellation and refund wording. Anything unconfirmed stays `[NEEDS PROOF]`.

## 3. Report

Give one table: item, status, evidence. Status is one of PASS (a command you ran proves it), FAIL, NOT RUN (say why) or OWNER (Eli must confirm). Then a verdict:

- **READY** only if every automated item passes and every owner item is confirmed.
- **READY AFTER OWNER CONFIRMATIONS** if automated items pass and only OWNER items are open.
- **NOT READY** otherwise, with the blocking items first.

If Eli wants to release, ask him to confirm the push to `main` explicitly. Only after he says yes, push (the guard hook will also ask him to approve). Otherwise give the `git add`, `git commit` and `git push` commands for PowerShell.
