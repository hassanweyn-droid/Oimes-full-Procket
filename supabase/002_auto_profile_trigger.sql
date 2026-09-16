-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 002: Auto-create profile on signup
-- Run this AFTER schema.sql. It fixes a gap in the original schema: there was
-- no way for a newly signed-up user to get their `public.users` row created
-- (no INSERT policy existed, and client-side inserts are unreliable if email
-- confirmation is required). This uses the standard Supabase pattern: a
-- SECURITY DEFINER trigger on auth.users that creates the profile row
-- server-side, bypassing RLS entirely.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, phone, first_name, last_name, display_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
