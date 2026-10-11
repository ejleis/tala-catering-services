-- Tala's Event Catering Services — catering orders paid through Maya
-- Run once in Supabase AFTER schema.sql: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is guarded.

create table if not exists catering_orders (
  id                 uuid primary key default gen_random_uuid(),  -- also Maya requestReferenceNumber (36 chars)
  reference          text not null unique,                        -- human-readable, e.g. CO-20261011-4821
  package_id         text not null,
  package_name       text not null,                               -- snapshot at order time
  customer_name      text not null check (char_length(customer_name)  between 1 and 120),
  customer_email     text not null check (char_length(customer_email) between 3 and 254),
  customer_phone     text not null check (char_length(customer_phone) between 5 and 30),
  event_date         date not null,
  venue              text not null check (char_length(venue) between 1 and 200),
  guests             integer not null check (guests >= 1),
  days               integer not null check (days between 1 and 30),
  rate_centavos      bigint not null check (rate_centavos > 0),   -- per-guest rate snapshot
  total_centavos     bigint not null check (total_centavos > 0),
  currency           char(3) not null default 'PHP',
  status             booking_status not null default 'PENDING_PAYMENT',
  expires_at         timestamptz not null,
  maya_checkout_id   text unique,
  maya_payment_id    text unique,
  maya_status        text,
  receipt_number     text,
  fund_source        text,
  paid_at            timestamptz,
  owner_email_status email_status not null default 'PENDING',
  customer_email_status email_status not null default 'PENDING',
  email_attempts     integer not null default 0,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint catering_total_adds_up check (total_centavos = rate_centavos * guests * days)
);

create index if not exists catering_orders_status_expires_idx on catering_orders (status, expires_at);
create index if not exists catering_orders_email_idx on catering_orders (lower(customer_email));

drop trigger if exists catering_orders_updated_at on catering_orders;
create trigger catering_orders_updated_at before update on catering_orders
  for each row execute function set_updated_at();

-- Same lock-down as the other tables: RLS on, no policies, no public API access.
alter table catering_orders enable row level security;
revoke all on catering_orders from anon, authenticated;
