-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 004: Realtime for the users table
-- Needed so the admin dashboard's "Registered users" list updates live when
-- someone signs up or gets suspended, without a manual refresh.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  alter publication supabase_realtime add table users;
exception when duplicate_object then
  null; -- already added, nothing to do
end $$;
