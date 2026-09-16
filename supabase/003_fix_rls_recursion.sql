-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 003: Fix infinite RLS recursion
-- The original admin_full_access_* policies checked the caller's role by
-- querying the `users` table from *inside* a policy defined ON `users` (and
-- on tables whose policies also reference `users`). Postgres re-applies RLS
-- to that inner query too, which re-triggers the same policy — infinite
-- recursion. The fix: move the role check into a SECURITY DEFINER function,
-- which bypasses RLS for that one internal lookup only.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- (Run this after schema.sql and 002_auto_profile_trigger.sql)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$ language sql security definer stable set search_path = public;

-- Replace every policy that used to query `users` directly with one that
-- calls is_admin() instead.

drop policy if exists admin_full_access_users on users;
create policy admin_full_access_users on users for all using (public.is_admin());

drop policy if exists admin_full_access_transactions on transactions;
create policy admin_full_access_transactions on transactions for all using (public.is_admin());

drop policy if exists admin_full_access_wallets on wallets;
create policy admin_full_access_wallets on wallets for all using (public.is_admin());

drop policy if exists audit_log_owner_select on audit_log;
create policy audit_log_owner_select on audit_log for select using (
  changed_by = auth.uid() or public.is_admin()
);
