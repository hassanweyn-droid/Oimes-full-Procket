-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 008: Rates management, KYC, real escrow, notifications,
-- admin wallet adjustment
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. EXCHANGE RATES — admins can now write, not just read
-- ─────────────────────────────────────────────────────────────────────────────

create policy exchange_rates_admin_write on exchange_rates
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. KYC — protect privileged columns + allow customers to self-submit
--
--    Without this, any signed-in customer could call
--    supabase.from('users').update({ role: 'admin' }) directly and grant
--    themselves admin access, since the existing users_owner_update policy
--    only checks *row* ownership, not *which columns* changed. This trigger
--    closes that hole: only admins can change role/is_active, and customers
--    can only move their own kyc_status to 'pending' (submit for review),
--    never straight to 'verified'.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function protect_privileged_user_columns()
returns trigger as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only admins can change role';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Only admins can change account status';
  end if;

  if new.kyc_status is distinct from old.kyc_status and new.kyc_status <> 'pending' then
    raise exception 'You can only submit KYC for review';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists users_protect_privileged_columns on users;
create trigger users_protect_privileged_columns
  before update on users
  for each row execute function protect_privileged_user_columns();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REAL ESCROW FLOW — supersedes the simplified 006 functions.
--    lock (create, debit sender → credit escrow) → execute/confirm (approve:
--    debit escrow → credit recipient) → rollback (deny: debit escrow →
--    credit sender back). This matches Chapter 3.4.3 exactly.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function create_exchange_transaction(
  p_from_wallet_id uuid,
  p_to_wallet_id uuid,
  p_from_amount numeric,
  p_to_amount numeric,
  p_rate numeric,
  p_spread numeric,
  p_fee_total numeric,
  p_description text default null
)
returns transactions as $$
declare
  v_from wallets%rowtype;
  v_to wallets%rowtype;
  v_tx transactions%rowtype;
  v_reference text;
begin
  select * into v_from from wallets where id = p_from_wallet_id for update;
  if not found or v_from.user_id <> auth.uid() then
    raise exception 'Source wallet not found or not yours';
  end if;

  select * into v_to from wallets where id = p_to_wallet_id for update;
  if not found or v_to.user_id <> auth.uid() then
    raise exception 'Destination wallet not found or not yours';
  end if;

  if v_from.status <> 'active' then
    raise exception 'Source wallet is %', v_from.status;
  end if;
  if v_to.status <> 'active' then
    raise exception 'Destination wallet is %', v_to.status;
  end if;
  if v_from.balance < p_from_amount then
    raise exception 'Insufficient balance';
  end if;

  v_reference := 'TX-OIMES-' || extract(epoch from now())::bigint || '-' || upper(substr(md5(random()::text), 1, 6));

  -- Lock: debit the sender now, move the funds into escrow for this platform.
  update wallets set balance = balance - p_from_amount, updated_at = now() where id = p_from_wallet_id;

  insert into escrow_wallets (platform, balance)
    values (v_from.platform, p_from_amount)
    on conflict (platform) do update set balance = escrow_wallets.balance + excluded.balance, updated_at = now();

  insert into transactions (
    reference, user_id, from_wallet_id, to_wallet_id, from_platform, to_platform,
    from_amount, to_amount, rate_applied, rate_spread, fee_total, status,
    from_phone, from_display_name, to_phone, to_display_name, description
  ) values (
    v_reference, auth.uid(), p_from_wallet_id, p_to_wallet_id, v_from.platform, v_to.platform,
    p_from_amount, p_to_amount, p_rate, p_spread, p_fee_total, 'pending',
    v_from.phone_number, v_from.display_name, v_to.phone_number, v_to.display_name, p_description
  ) returning * into v_tx;

  return v_tx;
end;
$$ language plpgsql security definer set search_path = public;

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

  -- Execute/confirm: release escrow, credit the recipient.
  update escrow_wallets set balance = balance - v_tx.from_amount, updated_at = now()
    where platform = v_tx.from_platform;

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

  -- Rollback: release escrow, refund the sender.
  update escrow_wallets set balance = balance - v_tx.from_amount, updated_at = now()
    where platform = v_tx.from_platform;

  update wallets set balance = balance + v_tx.from_amount, updated_at = now()
    where id = v_tx.from_wallet_id;

  update transactions
    set status = 'failed',
        failed_at = now(),
        failure_reason = coalesce(p_reason, 'Denied by administrator.'),
        approved_by = auth.uid()
    where id = p_transaction_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. NOTIFICATIONS — real table, populated server-side by triggers so they
--    show up on every device, not just the tab that created them.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('info', 'success', 'warning', 'error')),
  category text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  is_action_required boolean not null default false,
  related_entity jsonb,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

create policy notifications_owner_select on notifications for select using (user_id = auth.uid());
create policy notifications_owner_update on notifications for update using (user_id = auth.uid());
create policy notifications_admin_all on notifications for all using (public.is_admin()) with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table notifications;
exception when duplicate_object then
  null;
end $$;

create or replace function notify_transaction_submitted()
returns trigger as $$
begin
  insert into notifications (user_id, type, category, title, message, related_entity)
  values (
    new.user_id, 'info', 'transaction', 'Transaction Submitted',
    format('$%s exchange (%s) is pending admin approval.', new.from_amount, new.reference),
    jsonb_build_object('type', 'transaction', 'id', new.id)
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_transaction_submitted on transactions;
create trigger on_transaction_submitted
  after insert on transactions
  for each row execute function notify_transaction_submitted();

create or replace function notify_transaction_resolved()
returns trigger as $$
begin
  if new.status = 'completed' and old.status = 'pending' then
    insert into notifications (user_id, type, category, title, message, related_entity)
    values (
      new.user_id, 'success', 'transaction', 'Transaction Approved',
      format('Your $%s transfer (%s) was approved and completed.', new.from_amount, new.reference),
      jsonb_build_object('type', 'transaction', 'id', new.id)
    );
  elsif new.status = 'failed' and old.status = 'pending' then
    insert into notifications (user_id, type, category, title, message, related_entity)
    values (
      new.user_id, 'error', 'transaction', 'Transaction Denied',
      format('Your $%s transfer (%s) was denied. %s', new.from_amount, new.reference, coalesce(new.failure_reason, '')),
      jsonb_build_object('type', 'transaction', 'id', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_transaction_resolved on transactions;
create trigger on_transaction_resolved
  after update on transactions
  for each row execute function notify_transaction_resolved();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ADMIN WALLET ADJUSTMENT — manual balance correction, logged.
-- ─────────────────────────────────────────────────────────────────────────────

alter table admin_activity_log drop constraint if exists admin_activity_log_action_check;
alter table admin_activity_log add constraint admin_activity_log_action_check
  check (action in ('approve', 'deny', 'suspend', 'activate', 'adjust'));

create or replace function admin_adjust_wallet_balance(
  p_wallet_id uuid,
  p_amount numeric,
  p_reason text
)
returns void as $$
declare
  v_admin_username text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can adjust wallet balances';
  end if;

  update wallets set balance = balance + p_amount, updated_at = now() where id = p_wallet_id;
  if not found then
    raise exception 'Wallet not found';
  end if;

  select display_name into v_admin_username from users where id = auth.uid();

  insert into admin_activity_log (admin_id, admin_username, action, detail)
  values (
    auth.uid(),
    coalesce(v_admin_username, 'admin'),
    'adjust',
    format('Manually adjusted wallet %s by $%s — %s', p_wallet_id, p_amount, p_reason)
  );
end;
$$ language plpgsql security definer set search_path = public;
