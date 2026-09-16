-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 005: Extend wallets table
-- The original wallets table (schema.sql) only had balance + currency +
-- is_verified. The frontend's Wallets screen also needs a linked phone
-- number, a default-send-wallet flag, and an active/suspended status —
-- this migration adds those columns without touching existing data.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

alter table wallets
  add column if not exists phone_number text,
  add column if not exists display_name text,
  add column if not exists is_default boolean not null default false,
  add column if not exists status text not null default 'active' check (status in ('active', 'suspended', 'pending_verification')),
  add column if not exists last_synced_at timestamptz not null default now();
