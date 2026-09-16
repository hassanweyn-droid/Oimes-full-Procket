-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 009: Wallet top-up + KYC document reference
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── KYC document reference (simulated — no real file storage in this pass) ──
alter table users add column if not exists kyc_document_ref text;

-- ── Wallet top-up simulation ─────────────────────────────────────────────────
-- This app has no real payment gateway (per Chapter 3, mock adapters only),
-- so this simulates a deposit: the customer can "top up" their own wallet up
-- to a capped demo amount, so the app is actually usable end-to-end without
-- needing an admin to manually fund every new account.

create or replace function simulate_wallet_topup(p_wallet_id uuid, p_amount numeric)
returns wallets as $$
declare
  v_wallet wallets%rowtype;
begin
  if p_amount <= 0 or p_amount > 1000 then
    raise exception 'Top-up amount must be between $0 and $1000 (demo limit)';
  end if;

  select * into v_wallet from wallets where id = p_wallet_id for update;
  if not found or v_wallet.user_id <> auth.uid() then
    raise exception 'Wallet not found or not yours';
  end if;
  if v_wallet.status <> 'active' then
    raise exception 'This wallet is %', v_wallet.status;
  end if;

  update wallets set balance = balance + p_amount, updated_at = now()
    where id = p_wallet_id
    returning * into v_wallet;

  insert into notifications (user_id, type, category, title, message, related_entity)
  values (
    auth.uid(), 'success', 'wallet', 'Wallet Topped Up',
    format('$%s was added to your %s wallet.', p_amount, v_wallet.platform),
    jsonb_build_object('type', 'wallet', 'id', p_wallet_id)
  );

  return v_wallet;
end;
$$ language plpgsql security definer set search_path = public;
