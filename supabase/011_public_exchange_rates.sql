-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 011: Make exchange rates truly public-readable
--
-- The previous policy (auth.role() = 'authenticated') depends on the JWT's
-- role claim being exactly 'authenticated' at query time. RLS SELECT
-- policies don't error when they don't match — they just silently return
-- zero rows, which is exactly the "no exchange rate available" symptom with
-- no console error. Exchange rates aren't sensitive data (they're public
-- pricing), so the robust fix is to make them genuinely public — no auth
-- check at all.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists exchange_rates_read_all on exchange_rates;
create policy exchange_rates_read_all on exchange_rates for select using (true);
