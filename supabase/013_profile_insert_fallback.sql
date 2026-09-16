-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 013: Client-side profile creation fallback
--
-- The handle_new_user() trigger (002) has been unreliable in practice. This
-- adds an INSERT policy so the signed-up user can create their OWN profile
-- row directly from the app if the trigger didn't do it — belt and braces.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists users_self_insert on users;
create policy users_self_insert on users
  for insert with check (
    id = auth.uid()
    and role in ('customer', 'admin')
    and kyc_status = 'unverified'
    and is_active = true
  );
