-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 006: Real transactions + atomic escrow approve/deny
-- Two things:
--
-- 1. Adds snapshot columns to `transactions` (phone/display name for both
--    sides) so a transaction record shows exactly what the wallet looked
--    like at the time — the correct approach for financial records, and
--    avoids needing multi-table joins just to render a receipt.
--
-- 2. Adds approve_transaction / deny_transaction as SECURITY DEFINER
--    functions. This is the "execute → confirm/rollback" half of Chapter
--    3.4.3's escrow pattern: each function runs as ONE atomic Postgres
--    transaction, so two admins double-clicking Approve at the same moment
--    can't both succeed, and a debit can never happen without its matching
--    credit (or vice versa).
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

alter table transactions
  add column if not exists from_phone text,
  add column if not exists from_display_name text,
  add column if not exists to_phone text,
  add column if not exists to_display_name text,
  add column if not exists description text,
  add column if not exists rate_spread numeric(6, 4) not null default 0.015;

create or replace function approve_transaction(p_transaction_id uuid)
returns void as $$
declare
  v_tx transactions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve transactions';
  end if;

  select * into v_tx from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_tx.status <> 'pending' then
    raise exception 'Transaction is no longer pending';
  end if;

  update wallets set balance = balance - v_tx.from_amount, updated_at = now()
    where id = v_tx.from_wallet_id;

  update wallets set balance = balance + v_tx.to_amount, updated_at = now()
    where id = v_tx.to_wallet_id;

  update transactions
    set status = 'completed', completed_at = now(), approved_by = auth.uid()
    where id = p_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function deny_transaction(p_transaction_id uuid, p_reason text default null)
returns void as $$
declare
  v_tx transactions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can deny transactions';
  end if;

  select * into v_tx from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_tx.status <> 'pending' then
    raise exception 'Transaction is no longer pending';
  end if;

  update transactions
    set status = 'failed',
        failed_at = now(),
        failure_reason = coalesce(p_reason, 'Denied by administrator.'),
        approved_by = auth.uid()
    where id = p_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;
