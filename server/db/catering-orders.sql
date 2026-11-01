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

-- Down payments. The customer may pay the full total online (payment_type FULL) or any
-- amount from a minimum up to the total (DEPOSIT); the balance is settled offline with
-- Tala, so there is still exactly ONE Maya payment per order. amount_due_centavos is the
-- amount we ask Maya for and the amount reconcileOrder() verifies; total_centavos is
-- unchanged. Status CONFIRMED means "the payment we asked for was verified".
-- Written as guarded ALTERs so it upgrades an existing table and is safe to re-run.
alter table catering_orders add column if not exists payment_type text not null default 'FULL';
alter table catering_orders add column if not exists amount_due_centavos bigint;
update catering_orders set amount_due_centavos = total_centavos where amount_due_centavos is null;
alter table catering_orders alter column amount_due_centavos set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'catering_payment_type_valid') then
    alter table catering_orders add constraint catering_payment_type_valid
      check (payment_type in ('FULL', 'DEPOSIT'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'catering_amount_due_valid') then
    alter table catering_orders add constraint catering_amount_due_valid
      check (amount_due_centavos > 0 and amount_due_centavos <= total_centavos);
  end if;
  -- FULL means the whole total is due; DEPOSIT means less than the total. Catches code bugs.
  if not exists (select 1 from pg_constraint where conname = 'catering_payment_type_matches_amount') then
    alter table catering_orders add constraint catering_payment_type_matches_amount
      check ((payment_type = 'FULL') = (amount_due_centavos = total_centavos));
  end if;
end $$;

-- Inserts that do not name amount_due_centavos (older API code during a deploy) default
-- it to the full total, so adding the column never breaks live checkouts.
create or replace function public.catering_default_amount_due()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount_due_centavos is null then
    new.amount_due_centavos := new.total_centavos;
  end if;
  return new;
end;
$$;

drop trigger if exists catering_orders_default_amount_due on catering_orders;
create trigger catering_orders_default_amount_due before insert on catering_orders
  for each row execute function public.catering_default_amount_due();

-- Hardening columns (additive, nullable). See the matching block in schema.sql.
alter table catering_orders add column if not exists mismatch_alerted_at timestamptz;
alter table catering_orders add column if not exists owner_email_claimed_at timestamptz;
alter table catering_orders add column if not exists customer_email_claimed_at timestamptz;

-- Same lock-down as the other tables: RLS on, no policies, no public API access.
alter table catering_orders enable row level security;
revoke all on catering_orders from anon, authenticated;
