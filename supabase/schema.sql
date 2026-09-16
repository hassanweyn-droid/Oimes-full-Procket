-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Database Schema
-- Matches Chapter 3 (Methodology) exactly: five core tables (users, wallets,
-- exchange_rates, transactions, audit_log), the escrow-mediated three-phase
-- commit pattern (3.4.3), the real-time rate engine (3.4.4), and Row Level
-- Security policies (3.6.4) with append-only audit logging (3.6.5).
--
-- HOW TO USE:
-- 1. Open your Supabase project → SQL Editor → New query
-- 2. Paste this entire file and click "Run"
-- 3. All tables, policies, triggers, and seed data will be created
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Enums ─────────────────────────────────────────────────────────────────
create type platform_type as enum ('sahal', 'edahab', 'evc_plus', 'zaad');
create type kyc_status_type as enum ('unverified', 'pending', 'verified', 'rejected');
create type transaction_status as enum ('pending', 'completed', 'failed');

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. USERS
-- Extends Supabase's built-in auth.users (auth.uid() is the source of truth
-- for identity; this table holds the OIMES-specific profile fields).
-- ═══════════════════════════════════════════════════════════════════════════
create table users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  phone           text,
  first_name      text not null,
  last_name       text not null,
  display_name    text not null,
  role            text not null default 'customer' check (role in ('customer', 'admin', 'super_admin')),
  kyc_status      kyc_status_type not null default 'unverified',
  is_active       boolean not null default true,
  is_email_verified boolean not null default false,
  is_phone_verified boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table users is 'OIMES user profiles — one row per registered customer or admin, keyed to Supabase Auth.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. WALLETS
-- Pre-loaded float per user per platform (Chapter 3.4.2) — not a mirror of
-- the operator's real balance, but funds the user has topped up into OIMES.
-- ═══════════════════════════════════════════════════════════════════════════
create table wallets (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  platform        platform_type not null,
  balance         numeric(14, 2) not null default 0 check (balance >= 0),
  currency        text not null default 'USD',
  is_verified     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, platform)
);

comment on table wallets is 'Per-user, per-platform float balances held inside the OIMES ledger.';

-- System-owned escrow wallet (Chapter 3.4.3) — distinct from any user's wallet.
create table escrow_wallets (
  id              uuid primary key default uuid_generate_v4(),
  platform        platform_type not null unique,
  balance         numeric(14, 2) not null default 0 check (balance >= 0),
  updated_at      timestamptz not null default now()
);

comment on table escrow_wallets is 'System-owned escrow per platform — holds funds mid-transaction (lock → execute → confirm/rollback).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. EXCHANGE_RATES
-- Directional pairs (Chapter 3.4.4) — EVC→Zaad and Zaad→EVC are separate
-- rows since bid-ask spreads make them asymmetric.
-- ═══════════════════════════════════════════════════════════════════════════
create table exchange_rates (
  id              uuid primary key default uuid_generate_v4(),
  from_platform   platform_type not null,
  to_platform     platform_type not null,
  rate            numeric(12, 6) not null check (rate > 0),
  fee_percent     numeric(5, 4) not null default 0.015,
  updated_at      timestamptz not null default now(),
  unique (from_platform, to_platform)
);

comment on table exchange_rates is 'Directional exchange rate pairs, updated by the mock rate-feed Edge Function and pushed live via Supabase Realtime.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════
create table transactions (
  id                uuid primary key default uuid_generate_v4(),
  reference         text unique not null,
  user_id           uuid not null references users(id) on delete restrict,
  from_wallet_id    uuid not null references wallets(id),
  to_wallet_id      uuid not null references wallets(id),
  from_platform     platform_type not null,
  to_platform       platform_type not null,
  from_amount       numeric(14, 2) not null check (from_amount > 0),
  to_amount         numeric(14, 2) not null check (to_amount > 0),
  rate_applied      numeric(12, 6) not null,
  fee_total         numeric(14, 2) not null default 0,
  status            transaction_status not null default 'pending',
  failure_reason    text,
  initiated_at      timestamptz not null default now(),
  completed_at      timestamptz,
  failed_at         timestamptz,
  approved_by       uuid references users(id)
);

comment on table transactions is 'Every exchange request. Starts PENDING, moves to COMPLETED or FAILED via the escrow state machine (3.4.3).';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. AUDIT_LOG
-- Append-only, populated by trigger on transactions (Chapter 3.6.5).
-- ═══════════════════════════════════════════════════════════════════════════
create table audit_log (
  id              uuid primary key default uuid_generate_v4(),
  transaction_id  uuid references transactions(id),
  old_state       jsonb,
  new_state       jsonb,
  changed_by      uuid references users(id),
  changed_at      timestamptz not null default clock_timestamp()
);

comment on table audit_log is 'Append-only trail of every transaction state transition — non-repudiation evidence (3.6.5). INSERT-only at the RLS level.';

-- ─── Audit trigger ─────────────────────────────────────────────────────────
create or replace function log_transaction_change()
returns trigger as $$
begin
  insert into audit_log (transaction_id, old_state, new_state, changed_by)
  values (new.id, to_jsonb(old), to_jsonb(new), auth.uid());
  return new;
end;
$$ language plpgsql security definer;

create trigger transactions_audit_trigger
  after update on transactions
  for each row execute function log_transaction_change();

-- ─── updated_at auto-touch ───────────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_touch_updated_at    before update on users    for each row execute function touch_updated_at();
create trigger wallets_touch_updated_at  before update on wallets  for each row execute function touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY  (Chapter 3.6.4)
-- ═══════════════════════════════════════════════════════════════════════════
alter table users           enable row level security;
alter table wallets         enable row level security;
alter table transactions    enable row level security;
alter table audit_log       enable row level security;
alter table exchange_rates  enable row level security;
alter table escrow_wallets  enable row level security;

-- Role check used by every "admin override" policy below. Defined as
-- SECURITY DEFINER so it bypasses RLS for this one internal lookup — without
-- this, a policy on `users` that queries `users` would trigger the same
-- policy again and recurse infinitely.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql security definer stable set search_path = public;

-- Users can read/update only their own profile row.
create policy users_owner_select on users for select using (id = auth.uid());
create policy users_owner_update on users for update using (id = auth.uid());

-- The exact policy quoted in Chapter 3.6.4:
create policy wallet_owner_policy on wallets using (user_id = auth.uid());

-- Users can see only transactions where they are the sender.
create policy transactions_owner_select on transactions for select using (user_id = auth.uid());
create policy transactions_owner_insert on transactions for insert with check (user_id = auth.uid());

-- audit_log: INSERT-only, no UPDATE/DELETE policy exists → both are denied by default.
create policy audit_log_insert_only on audit_log for insert with check (true);
create policy audit_log_owner_select on audit_log for select using (
  changed_by = auth.uid() or public.is_admin()
);

-- exchange_rates: readable by everyone signed in; writes reserved for the rate-feed service role.
create policy exchange_rates_read_all on exchange_rates for select using (auth.role() = 'authenticated');

-- Admin override: admins/super_admins can see and act on every row.
create policy admin_full_access_users on users for all using (public.is_admin());
create policy admin_full_access_transactions on transactions for all using (public.is_admin());
create policy admin_full_access_wallets on wallets for all using (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- REALTIME  (Chapter 3.4.4 — UI subscribes to exchange_rates via WebSocket)
-- ═══════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table exchange_rates;
alter publication supabase_realtime add table transactions;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — mock rates + escrow wallets so the app has something to show
-- ═══════════════════════════════════════════════════════════════════════════
insert into escrow_wallets (platform, balance) values
  ('sahal', 0), ('edahab', 0), ('evc_plus', 0), ('zaad', 0);

insert into exchange_rates (from_platform, to_platform, rate, fee_percent) values
  ('sahal', 'edahab', 0.998, 0.015),
  ('edahab', 'sahal', 1.002, 0.015),
  ('sahal', 'evc_plus', 1.001, 0.015),
  ('evc_plus', 'sahal', 0.999, 0.015),
  ('sahal', 'zaad', 0.997, 0.015),
  ('zaad', 'sahal', 1.003, 0.015),
  ('edahab', 'evc_plus', 1.000, 0.015),
  ('evc_plus', 'edahab', 1.000, 0.015),
  ('edahab', 'zaad', 0.996, 0.015),
  ('zaad', 'edahab', 1.004, 0.015),
  ('evc_plus', 'zaad', 0.995, 0.015),
  ('zaad', 'evc_plus', 1.005, 0.015);
