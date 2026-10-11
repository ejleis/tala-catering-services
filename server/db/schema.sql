-- Tala's Event Catering Services — hotel booking + Maya payments
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pgcrypto;

-- ---------- Enumerated states ----------
create type booking_status as enum (
  'PENDING_PAYMENT',     -- created, guest sent to Maya
  'PAYMENT_PROCESSING',  -- Maya reports in-flight
  'CONFIRMED',           -- payment verified by server
  'PAYMENT_FAILED',
  'CANCELLED',
  'EXPIRED'              -- checkout window lapsed unpaid
);

create type payment_status as enum (
  'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'
);

create type email_status as enum ('PENDING', 'SENT', 'FAILED');

-- ---------- Shared updated_at trigger ----------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- bookings ----------
create table bookings (
  id               uuid primary key default gen_random_uuid(),  -- also Maya requestReferenceNumber (36 chars)
  reference        text not null unique,                        -- human-readable, e.g. HB-20261011-4821
  hotel_slug       text not null,
  room_id          text not null,
  hotel_name       text not null,                               -- snapshot at booking time
  room_name        text not null,
  guest_name       text not null check (char_length(guest_name)  between 1 and 120),
  guest_email      text not null check (char_length(guest_email) between 3 and 254),
  guest_phone      text not null check (char_length(guest_phone) between 5 and 30),
  special_requests text check (char_length(special_requests) <= 1000),
  check_in         date not null,
  check_out        date not null,
  nights           integer not null check (nights between 1 and 30),
  guests           integer not null check (guests >= 1),
  rooms            integer not null check (rooms >= 1),
  rate_centavos    bigint not null check (rate_centavos > 0),   -- nightly rate snapshot
  subtotal_centavos bigint not null check (subtotal_centavos > 0),
  tax_centavos     bigint not null check (tax_centavos >= 0),
  total_centavos   bigint not null check (total_centavos > 0),
  currency         char(3) not null default 'PHP',
  status           booking_status not null default 'PENDING_PAYMENT',
  expires_at       timestamptz not null,                        -- unpaid holds lapse (Maya checkout lasts 1h)
  owner_email_status email_status not null default 'PENDING',
  guest_email_status email_status not null default 'PENDING',
  email_attempts   integer not null default 0,
  confirmed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint stay_order check (check_out > check_in),
  constraint total_adds_up check (total_centavos = subtotal_centavos + tax_centavos)
);

create index bookings_status_expires_idx on bookings (status, expires_at);
create index bookings_room_dates_idx     on bookings (hotel_slug, room_id, check_in, check_out)
  where status in ('PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED');
create index bookings_guest_email_idx    on bookings (lower(guest_email));

create trigger bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

-- ---------- payments (one booking may have several attempts) ----------
create table payments (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references bookings(id) on delete restrict,
  provider                 text not null default 'maya',
  maya_checkout_id         text unique,
  maya_payment_id          text unique,                         -- set once Maya reports a payment
  request_reference_number text not null,                       -- = bookings.id as text
  amount_centavos          bigint not null check (amount_centavos > 0),
  currency                 char(3) not null default 'PHP',
  status                   payment_status not null default 'PENDING',
  maya_status              text,                                -- raw status string from Maya
  receipt_number           text,
  fund_source              text,                                -- e.g. card / wallet type
  paid_at                  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index payments_booking_idx on payments (booking_id);
create index payments_ref_idx     on payments (request_reference_number);
-- A booking can have at most one PAID payment.
create unique index payments_one_paid_per_booking on payments (booking_id) where status = 'PAID';

create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();

-- ---------- webhook_events (idempotency + audit; body is untrusted, kept as-is) ----------
create table webhook_events (
  id               bigint generated always as identity primary key,
  maya_payment_id  text,
  payment_status   text,
  payload          jsonb not null,
  source_ip        inet,
  verified         boolean not null default false,             -- true after re-fetch from Maya matched
  received_at      timestamptz not null default now(),
  processed_at     timestamptz
);

create index webhook_events_payment_idx on webhook_events (maya_payment_id, received_at);

-- ---------- Lock the tables from Supabase's public API ----------
-- RLS on, no policies => anon/authenticated keys can read or write nothing.
-- The Express server connects with the DATABASE_URL (postgres role), which bypasses RLS.
alter table bookings       enable row level security;
alter table payments       enable row level security;
alter table webhook_events enable row level security;
revoke all on bookings, payments, webhook_events from anon, authenticated;
