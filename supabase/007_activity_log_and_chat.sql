-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 007: Admin activity log + support chat, for real
-- Both of these were still living in localStorage. This adds the two tables
-- and their RLS policies so they're shared across every browser/device
-- instead of just tabs of one browser.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Admin activity log ──────────────────────────────────────────────────────
-- Every approve/deny/suspend/activate an admin performs, with who and when.

create table if not exists admin_activity_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references users(id),
  admin_username text not null,
  action text not null check (action in ('approve', 'deny', 'suspend', 'activate')),
  detail text not null,
  created_at timestamptz not null default now()
);

alter table admin_activity_log enable row level security;

create policy admin_activity_log_admin_only on admin_activity_log
  for all using (public.is_admin()) with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table admin_activity_log;
exception when duplicate_object then
  null;
end $$;

-- ── Support chat ─────────────────────────────────────────────────────────────
-- One conversation per customer (user_id = which customer it's with, not who
-- sent it — an admin's reply also carries the customer's user_id).

create table if not exists support_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  sender_name text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table support_messages enable row level security;

-- Customers can see and send messages only in their own conversation.
create policy support_messages_customer_select on support_messages
  for select using (user_id = auth.uid());
create policy support_messages_customer_insert on support_messages
  for insert with check (user_id = auth.uid() and sender = 'user');

-- Admins can see and reply in every conversation.
create policy support_messages_admin_all on support_messages
  for all using (public.is_admin()) with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table support_messages;
exception when duplicate_object then
  null;
end $$;
