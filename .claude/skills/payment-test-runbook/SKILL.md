---
name: payment-test-runbook
description: Guided, step-by-step real payment test of Tala's production Maya setup using the hidden test item (about PHP 1), with the same-day void and a targeted cleanup. Eli runs every request himself; Claude only guides and checks what he pastes back.
when_to_use: Eli wants to finish the paid test and void, prove the Maya webhook arrives, or switch the test item on or off.
disable-model-invocation: true
---

# Payment test runbook (production, no sandbox)

This test moves real money on the client's Maya account. Claude's role is to guide and to check results Eli pastes back. Claude never sends the requests, never runs SQL, never asks for keys, and redacts anything secret that is pasted (then tells Eli to rotate it). A hook also blocks Claude from calling the production order routes.

**Time limit:** a Maya void works only on the same day, before midnight Manila time (GMT+8). If it is already late, stop and do the test tomorrow morning.

## Before you start (ask Eli to confirm each)

- The Maya secret key and Supabase database password exposed earlier have been rotated.
- Render log shows `Maya payments: ENABLED (production)`.
- For a catering test: `server/db/catering-orders.sql` has been run in Supabase.
- Void and Refund are enabled on the Maya account (through the Maya Relationship Manager).
- The client knows a test is coming. The owner confirmation email goes to `OWNER_EMAIL`, and a test transaction will appear on the client's Maya account.

## Step 1. Turn the test item on

Render, service `tala-catering-api`, Environment: set `ALLOW_TEST_ITEM=true` and `TEST_ITEM_PESOS=1`. Save and wait for the deploy. The Render log must show `WARNING: hidden TEST ITEM is ON at PHP 1`.

## Step 2. Create one test order (Eli runs it in PowerShell)

Pick catering (total PHP 1.00) or hotel (total PHP 1.12, because the 12% placeholder tax applies). One is enough. Render's free tier can take 30 to 60 seconds to wake up, so the timeout is long. Phone numbers must start with `63`, `+63` or `0`, then 9 to 15 digits.

Catering:

```powershell
$api = "https://tala-catering-api.onrender.com"
$body = @{
  name      = "Test Customer"
  email     = "<your own email>"
  phone     = "<your PH mobile number>"
  eventDate = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
  venue     = "Payment test"
  packageId = "test"
  guests    = 1
  days      = 1
} | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri "$api/api/catering-orders" -ContentType "application/json" -Body $body -TimeoutSec 120
$r
```

Hotel:

```powershell
$body = @{
  name      = "Test Customer"
  email     = "<your own email>"
  phone     = "<your PH mobile number>"
  hotelSlug = "test-hotel"
  roomId    = "test-room"
  checkIn   = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
  checkOut  = (Get-Date).AddDays(31).ToString("yyyy-MM-dd")
  guests    = 1
  rooms     = 1
} | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri "$api/api/bookings" -ContentType "application/json" -Body $body -TimeoutSec 120
$r
```

Expected: `ok`, a `reference` (`CO-...` or `HB-...`), `orderId` or `bookingId`, `status = PENDING_PAYMENT` and a `checkoutUrl`. If something else comes back:

- `503`: Maya or database variables are missing on Render.
- `400 That package cannot be paid online` or `Unknown hotel`: the test item is not active. Check both variables, that `TEST_ITEM_PESOS` is a number from 1 to 100, and that the deploy finished.
- `429`: the limit is 10 order requests per hour per IP.

## Step 3. Pay it

```powershell
Start-Process $r.checkoutUrl
```

Pay the PHP 1 (or 1.12) with your own card or wallet. The checkout link lasts 60 minutes. The `/payment/success` page only displays; it confirms nothing.

## Step 4. Check the server confirmed it

```powershell
# catering
Invoke-RestMethod "$api/api/catering-orders/$($r.orderId)/status"
# hotel
Invoke-RestMethod "$api/api/bookings/$($r.bookingId)/status"
```

Expected `status = CONFIRMED` and `totalCentavos` of 100 (catering) or 112 (hotel). Asking for the status makes the server ask Maya directly, so this works even if the webhook never arrived.

## Step 5. Prove whether Maya's webhook arrived

Supabase SQL editor (read-only):

```sql
select id, payment_status, verified, source_ip, received_at, processed_at
from webhook_events
order by received_at desc
limit 5;
```

A row received just after you paid, with `verified = true`, proves Maya delivered the webhook and the server matched it. No row means confirmation came from the status check or the 5-minute sweeper instead. That is the open webhook problem to raise with Maya support. Do not paste the `payload` column here.

Also check the emails: the owner email to `OWNER_EMAIL`, and the customer email to the address you used. If either is missing, look at the Resend dashboard Logs tab.

## Step 6. Void it in Maya Manager, today

Find the payment in Maya Manager and void the full amount before midnight Manila time. After midnight it can only be refunded, not voided. Confirm it now shows as voided.

## Step 7. Turn the test item off

Render, Environment: delete `ALLOW_TEST_ITEM` and `TEST_ITEM_PESOS`. Save and wait for the deploy. The log must no longer show the `TEST ITEM is ON` warning. Optional check: repeat step 2 and expect `400 That package cannot be paid online`. That request stops before reaching Maya, so it creates nothing.

## Step 8. Remove only the test rows

Do not use `truncate webhook_events, payments, bookings, catering_orders;` once the site has taken any real order. It deletes every row, including real customers'. First see what is in the tables:

```sql
select 'bookings' as t, count(*) from bookings
union all select 'catering_orders', count(*) from catering_orders
union all select 'payments', count(*) from payments
union all select 'webhook_events', count(*) from webhook_events;
```

If every row is a test row, truncate is fine. Otherwise delete only your test records. Replace the IDs with the `orderId` or `bookingId` from step 2:

```sql
-- catering test
delete from webhook_events
  where maya_payment_id = (select maya_payment_id from catering_orders where id = '<ORDER_ID>');
delete from catering_orders where id = '<ORDER_ID>';

-- hotel test (payments must go before bookings)
delete from webhook_events
  where maya_payment_id in (select maya_payment_id from payments where booking_id = '<BOOKING_ID>' and maya_payment_id is not null);
delete from payments where booking_id = '<BOOKING_ID>';
delete from bookings where id = '<BOOKING_ID>';
```

## Step 9. Wrap up

Summarise results from what Eli pasted: order created, paid, `CONFIRMED`, webhook row present or absent, emails received, voided, test variables removed, rows cleaned. Mark each PASS, FAIL or NOT CONFIRMED. Then tell Eli to inform the client that a test transaction was made and voided, and offer to update `CLAUDE.md` (section 8 status, open items 5 and 6). Eli commits any such change himself.
