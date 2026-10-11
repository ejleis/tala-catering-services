# Tala's Event Catering Services

React + Tailwind CSS website with two distinct transaction models:

| Area | Flow | Payment |
|---|---|---|
| **Catering** | Browse packages → Kasalo / Handaan: Checkout and pay with Maya; Bespoke: submit inquiry → owner receives email | Maya Checkout (Kasalo, Handaan) |
| **Hotel booking** | Choose hotel → pick dates & room → guest details → booking request | Maya (pending account activation) |

---

## Project structure

```
├── index.html
├── vite.config.js
├── .env.example
├── src/
│   ├── main.jsx                 App entry + router provider
│   ├── App.jsx                  Route definitions
│   ├── index.css                Tailwind v4 @theme design tokens
│   ├── data/                    Content, separated from presentation
│   │   ├── site.js              Business details, navigation
│   │   ├── catering.js          Services, menu, packages, gallery
│   │   └── hotels.js            Hotel + room data
│   ├── lib/
│   │   ├── validation.js        Client-side validation (UX only)
│   │   ├── format.js            Peso/date formatting, night calculation
│   │   └── api.js               Typed API client — no secrets, ever
│   ├── hooks/
│   │   └── useSubmitForm.js     Shared submit lifecycle
│   ├── components/
│   │   ├── ui/                  Button, Field, Alert, Image, Icons, Section
│   │   ├── layout/              Header, Footer, Layout, ScrollToTop
│   │   ├── catering/            Hero, About, Services, Menu, Packages, Inquiry
│   │   └── hotels/              HotelCard, BookingWidget, RoomCard, Booking*
│   └── pages/                   HomePage, HotelsPage, HotelDetailPage, 404
└── server/                      Reference API (Express)
    ├── index.js                 Middleware, CORS, rate limiting
    ├── routes/                  inquiries.js, bookings.js
    └── lib/                     validation.js (authoritative), mailer.js
```

**Why this shape:** data is separate from components so the client can edit
content without touching JSX; `ui/` holds primitives with no business logic;
`pages/` compose features; `lib/` is framework-agnostic and unit-testable.

---

## Keeping room data in sync

`src/data/hotels.js` (what the site displays) and `server/routes/bookings.js`'s
`CATALOGUE` (what the server will actually accept and price a booking for)
must list the exact same room IDs per hotel — the server intentionally never
trusts a price sent from the browser, so it looks the room up in its own
catalogue instead. These two files have drifted out of sync before, which
either broke bookings for a room the server didn't recognize, or left the
server accepting bookings for rooms invisible on the site.

Run this after editing rooms in either file:

```bash
npm run check:rooms
```

It exits non-zero and prints exactly which hotel and room IDs are mismatched
if anything is out of sync — safe to run before every push.

---

## Running locally

```bash
# Frontend
npm install
npm run dev            # http://localhost:5173

# API (separate terminal)
cd server
npm install
cp ../.env.example .env   # then fill in RESEND_API_KEY + OWNER_EMAIL
npm run dev            # http://localhost:3001
```

The frontend reads `VITE_API_BASE_URL` (defaults to same-origin if unset).

---

## Setting up email (Resend)

Inquiry and booking notifications send through **Resend**, a transactional
email API, to `talaseventcateringservices@gmail.com`.

**Why not Gmail SMTP directly:** most free hosting tiers — including
Render's free plan, which this project targets — block outbound traffic on
SMTP ports 25, 465, and 587 entirely, as an anti-spam measure. An SMTP-based
mailer works perfectly locally and then times out silently once deployed.
Resend sends over a normal HTTPS request instead, which is never blocked.

**Important constraint:** Resend can only send emails *from* a domain you've
verified you control — it cannot send from `@gmail.com`, since Google's DNS
isn't yours to verify. `OWNER_EMAIL` (who *receives* the notification) can
still be the Gmail address; only the sending address is restricted.

### One-time setup

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month, 100/day — comfortably enough for a small catering site).
2. **Verify your domain**: Dashboard → **Domains** → **Add Domain** → enter `tala-ecs.com`. Resend shows you a few DNS records (SPF, DKIM, and a tracking CNAME).
3. Add those records at **Hostinger** the same way you added the Vercel A/CNAME records earlier: **Domains → tala-ecs.com → DNS Zone Editor**. Paste in exactly what Resend shows you.
4. Back in Resend, wait for the domain status to show **Verified** (usually a few minutes, occasionally longer — DNS propagation again).
5. Go to **API Keys** → **Create API Key** → name it (e.g. "Tala's website") → copy the key. It's shown once.
6. In `server/.env`, set:
   ```
   RESEND_API_KEY=<the key you just copied>
   OWNER_EMAIL=talaseventcateringservices@gmail.com
   MAIL_FROM="Tala's Event Catering Services <inquiries@tala-ecs.com>"
   ```
7. Restart the server (`npm run dev` inside `server/`) and submit the inquiry form locally to confirm an email actually arrives.

### Testing before domain verification finishes

If you want to test immediately without waiting on DNS, Resend provides a
shared sandbox sender — set `MAIL_FROM="Tala's Event Catering Services <onboarding@resend.dev>"`
temporarily. This can only deliver to the email address on your own Resend
account, not to arbitrary customer addresses, so switch back to
`inquiries@tala-ecs.com` once your domain shows Verified.

**If it stops working later**, check the Resend dashboard's **Logs** tab
first — it shows the exact delivery status and error per email, which is far
more specific than anything the server can tell you.

**Where these variables actually need to live:** `.env` only works for your
own machine. Whatever you deploy `server/` to needs these same three
variables set in *that* platform's environment variable dashboard, not just
in a local file.

---

## Routes

| Route | Page |
|---|---|
| `/` | Catering home + inquiry form |
| `/hotels` | Hotel listing |
| `/hotels/swiss-belhotel-blulane` | Hotel detail + booking |
| `/hotels/bay-area-suites-manila` | Hotel detail + booking |
| `/hotels/red-hotel-cubao` | Hotel detail + booking |
| `*` | 404 |

> **SPA hosting note:** all routes must rewrite to `index.html`, or a hard
> refresh on `/hotels/...` will 404. Netlify: `/* /index.html 200`.
> Vercel handles this automatically for Vite projects.

---

## Security

### Implemented

**Frontend**
- No secrets in client code. `VITE_`-prefixed vars are public by definition and
  contain no credentials.
- No `dangerouslySetInnerHTML` anywhere — React escapes all interpolated
  content, so user input cannot become markup.
- External links use `rel="noopener noreferrer"` (blocks reverse tabnabbing).
- The client never calls Maya or the mail provider directly.
- Honeypot field on both forms.
- Input `maxLength` on every free-text field.

**Backend**
- **Server-side re-validation of everything.** Client validation is UX only.
- **Prices are never trusted from the request.** The server looks up the room
  rate from its own catalogue and computes the total — otherwise a user could
  edit the price in devtools.
- Occupancy and stay length (1–30 nights) enforced server-side.
- Rate limiting: 5 inquiries/hour, 10 bookings/hour per IP, 100 API calls/15min.
- `helmet` for security headers; CORS restricted to your origin; 32 kb body cap.
- **Email header injection blocked** — CR/LF stripped from any header value.
- **HTML-escaped** email templates.
- **CSV injection** neutralised (values starting `=`, `+`, `-`, `@` are prefixed)
  since owners routinely paste inquiries into spreadsheets.
- Type-confusion guarded: non-string input coerces to `''` rather than passing
  objects/arrays through.
- `crypto.randomInt` for booking references, not `Math.random`.
- Stack traces never returned to clients.

### Security headers (set at your host, not in HTML)

```
Content-Security-Policy: default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://YOUR-API-DOMAIN; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Still required before launch

- [ ] HTTPS enforced (Maya requires it)
- [ ] Availability/inventory checks with row-level locking to prevent double booking
- [ ] Replace `[NEEDS PROOF]` placeholders in `src/data/`
- [ ] Privacy policy — you are collecting personal data under the PH Data
      Privacy Act (RA 10173); registration with the NPC may be required

---

## Maya payments

Hotel bookings are paid through Maya Checkout (hosted page):

1. `POST /api/bookings` validates the request, computes the price **on the
   server**, stores the booking (`PENDING_PAYMENT`) and a payment row, creates
   a Maya checkout and returns `checkoutUrl`; the browser is redirected there.
2. Maya sends the customer back to `/payment/success|failure|cancel?b=<id>`.
   These pages are **display-only** and poll `GET /api/bookings/:id/status`.
3. A booking becomes `CONFIRMED` only in `server/lib/payments.js`, after the
   server has asked Maya (secret key) about that booking and the reference,
   amount and currency match the database. This runs from Maya's webhook
   (`POST /api/maya/webhook`) **and** from the status poll, so a delayed or
   blocked webhook cannot leave a paid customer unconfirmed.
4. Webhooks are not signed by Maya: they are accepted only from Maya's
   published IPs (`CLIENT_IP_HEADER`), stored in `webhook_events`, and never
   believed — they only trigger step 3. Processing is idempotent.

Database schema: `server/db/schema.sql` (run once in the Supabase SQL editor).
Tests: `cd server && TEST_DATABASE_URL=... npm test` (fake Maya + real Postgres).

Required server variables: `DATABASE_URL`, `MAYA_ENVIRONMENT`,
`MAYA_PUBLIC_KEY`, `MAYA_SECRET_KEY`, `FRONTEND_URL`, `CLIENT_IP_HEADER`.
If any Maya variable is missing the API refuses bookings (503) instead of
taking ones that cannot be paid.

## Demo data notice

Hotel names are real partner properties. **All room types, rates, availability,
ratings, amenities, and photos are placeholders** and must be replaced with
details confirmed in writing by each property. Publishing invented rates for a
real hotel carries commercial and legal risk for the client.

### Catering payments

Kasalo and Handaan are paid through the same Maya Checkout flow as hotel bookings
(`POST /api/catering-orders`, status at `GET /api/catering-orders/:id/status`). Orders
live in the `catering_orders` table — run `server/db/catering-orders.sql` once in
Supabase after `schema.sql`. The server prices every order from its own copy of the
rates in `server/routes/catering.js`; keep them identical to `src/data/catering.js`.
The same webhook (`/api/maya/webhook`) serves both flows. A background check verifies
unpaid bookings and orders with Maya a few minutes after creation, so a payment is
confirmed even if the webhook never arrives.
