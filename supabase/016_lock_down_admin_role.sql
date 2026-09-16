-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 016: Lock down the `role` column
--
-- Found while auditing: `role` could be set to 'admin' (or even
-- 'super_admin') by anyone holding nothing more than the public anon key —
-- no admin access and no special permission needed. Three separate paths
-- all led to the same hole:
--
--   1. handle_new_user() (002 / 015) copied `role` straight out of the
--      signup call's own metadata — anyone could pass
--      `{ data: { role: 'admin' } }` to auth.signUp() and get an admin row
--      created for themselves on the spot.
--   2. users_self_insert (013) explicitly allowed `role in ('customer',
--      'admin')` on a client-side insert of your own profile row.
--   3. users_owner_update (schema.sql) let a signed-in user update *any*
--      column on their own row, `role` included — so even an existing,
--      perfectly normal customer could run
--      `update users set role = 'admin' where id = auth.uid()` from their
--      browser console and grant themselves admin access. No signup, no
--      form, nothing — this was the most serious of the three.
--
-- This migration closes all three at once, at the one place that actually
-- matters: a trigger on `users` itself. It doesn't rewrite any of that
-- other logic — it's simpler and more robust to make `role` impossible to
-- write to anything but 'customer' from an end-user session, full stop,
-- than to audit every current and future code path that touches this
-- table.
--
-- HOW IT WORKS
-- `auth.uid()` is null when a request carries no end-user JWT — that's you,
-- running this in the Supabase SQL Editor, or a service-role call. Those
-- are trusted (only the project owner has dashboard access) and pass
-- through untouched. Anything running with a real end-user session gets
-- `role` forced back to 'customer' (on insert) or left unchanged (on
-- update) — UNLESS that session already belongs to an existing admin, so
-- the admin dashboard's own user-management actions keep working exactly
-- as before. Nobody can grant *themselves* the upgrade any more.
--
-- ── ONE-TIME SETUP: creating your one admin account ─────────────────────
--   1. Sign up normally, as a customer, through the regular app (or via
--      Supabase dashboard → Authentication → Add user) with whichever
--      email you want to use for admin access.
--   2. Run this once in the SQL Editor, with your real email:
--
--        update public.users set role = 'super_admin'
--        where email = 'you@example.com';
--
--   3. Log in at /admin with that same email + password. There is no
--      "create admin account" page any more — this SQL update is the only
--      way an admin account can be created from here on.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Never trust a client-supplied role at signup, regardless of what was
--    sent in auth.signUp()'s metadata.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, phone, first_name, last_name, display_name, role, city, region)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    'customer', -- hardcoded — signup can never grant elevated access
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'region'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 2) Tighten the insert-fallback policy from 013 to match intent — it used
--    to explicitly allow 'admin' here too. The trigger below already
--    forces this regardless, but the policy shouldn't claim to allow
--    something it will silently undo.
drop policy if exists users_self_insert on users;
create policy users_self_insert on users
  for insert with check (
    id = auth.uid()
    and role = 'customer'
    and kyc_status = 'unverified'
    and is_active = true
  );

-- 3) The real fix: a trigger that runs on every insert/update to `users`
--    and strips out any attempt to set `role` from a non-admin end-user
--    session — closes the self-UPDATE hole (#3 above), which no policy
--    tweak alone can do since RLS can't restrict a single column.
create or replace function public.protect_role_column()
returns trigger as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if TG_OP = 'INSERT' then
      new.role := 'customer';
    elsif TG_OP = 'UPDATE' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists users_protect_role on public.users;
create trigger users_protect_role
  before insert or update on public.users
  for each row execute function public.protect_role_column();
