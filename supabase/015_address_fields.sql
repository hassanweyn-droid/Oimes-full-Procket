-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 015: Real address (city/region) at signup
-- Profile was showing a hardcoded "Somalia" that didn't come from anywhere —
-- this adds real city/region columns, collected at signup, and updates the
-- auto-create trigger to store them too.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

alter table users add column if not exists city text;
alter table users add column if not exists region text;

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
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'region'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
