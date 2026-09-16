-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 012: Re-seed exchange rates (+ escrow wallets)
--
-- Found: exchange_rates was empty — the seed insert in schema.sql apparently
-- never took (maybe skipped, or the script stopped partway on an earlier
-- run). This re-inserts it safely — ON CONFLICT DO NOTHING means it's safe
-- to run even if some rows already exist.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

insert into escrow_wallets (platform, balance) values
  ('sahal', 0), ('edahab', 0), ('evc_plus', 0), ('zaad', 0)
on conflict (platform) do nothing;

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
  ('zaad', 'evc_plus', 1.005, 0.015)
on conflict (from_platform, to_platform) do nothing;

-- Sanity check — should return 12 rows after this runs.
select count(*) as rate_count from exchange_rates;
