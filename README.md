# Tala's Event Catering Services

React + Tailwind CSS website with two distinct transaction models:

| Area | Flow | Payment |
|---|---|---|
| **Catering** | Browse packages → submit inquiry → owner receives email | None — inquiry only |
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

## Running locally

```bash
# Frontend
npm install
npm run dev            # http://localhost:5173

# API (separate terminal)
cd server
npm install
cp ../.env.example .env   # then fill in SMTP + OWNER_EMAIL
npm run dev            # http://localhost:3001
```

The frontend reads `VITE_API_BASE_URL` (defaults to same-origin if unset).

---

## Setting up email (Gmail)

Inquiry and booking notifications send through Gmail's SMTP relay to
`talaseventcateringservices@gmail.com`. Gmail **rejects a normal account
password over SMTP** — you must generate a 16-character **App Password**
instead. This only has to be done once.

1. Sign in to the `talaseventcateringservices@gmail.com` Google Account.
2. Turn on **2-Step Verification** if it isn't already on — App Passwords
   require it: [myaccount.google.com/security](https://myaccount.google.com/security).
3. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
4. Enter a name (e.g. "Tala's website") and click **Create**.
5. Google shows a 16-character password once. Copy it — you can't view it again later.
6. In `server/.env`, set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=talaseventcateringservices@gmail.com
   SMTP_PASSWORD=<the 16-character app password, no spaces>
   OWNER_EMAIL=talaseventcateringservices@gmail.com
   MAIL_FROM="Tala's Event Catering Services <talaseventcateringservices@gmail.com>"
   ```
7. Restart the server (`npm run dev` inside `server/`) and submit the inquiry
   form locally to confirm an email actually arrives.

**If it stops working later**, the most common cause is the App Password
being revoked (e.g. after a password change) — generate a new one and update
`.env`.

**Gmail's free sending limit is ~500 messages/day**, which is far more than a
small catering site needs, but worth knowing if inquiry volume ever grows a
lot — at that point a dedicated transactional provider (Postmark, Resend,
SendGrid) would be the next step, and only the SMTP_* values need to change.

**Where these variables actually need to live:** `.env` only works for
your own machine. Whatever you deploy `server/` to (see "Still required
before launch" below — it isn't deployed anywhere yet) needs these same six
variables set in *that* platform's environment variable settings, not just
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
- [ ] Real database — the server catalogue and bookings are currently in-memory
- [ ] Booking persistence with status: `PENDING_PAYMENT → PAID → CONFIRMED`
- [ ] Availability/inventory checks with row-level locking to prevent double booking
- [ ] Replace `[NEEDS PROOF]` placeholders in `src/data/`
- [ ] Privacy policy — you are collecting personal data under the PH Data
      Privacy Act (RA 10173); registration with the NPC may be required

---

## Maya integration (when the account is ready)

Currently `POST /api/bookings` records the request and emails the owner. The
booking form states plainly that payment is not yet active.

To switch it on:

1. Put `MAYA_SECRET_KEY` in the **server** `.env`. Never in a `VITE_` variable.
2. In `server/routes/bookings.js`, after validation, call Maya's Checkout API
   server-side with the **server-computed** total and return `{ checkoutUrl }`.
3. In `src/components/hotels/BookingForm.jsx`, uncomment the redirect in
   `onSuccess` (one line — already written).
4. Implement the webhook handler in `server/routes/bookings.js`. Signature
   verification and timing-safe comparison are already scaffolded.

**Non-negotiable:** a booking becomes `PAID` only from a verified webhook.
Never because the browser reached a success URL — that URL is trivially
guessable and forgeable.

Verify header names and the exact API against Maya's current official docs
before going live; do not rely on this scaffold's assumptions.

---

## Demo data notice

Hotel names are real partner properties. **All room types, rates, availability,
ratings, amenities, and photos are placeholders** and must be replaced with
details confirmed in writing by each property. Publishing invented rates for a
real hotel carries commercial and legal risk for the client.
