-- ═══════════════════════════════════════════════════════════════════════════
-- OIMES — Migration 010: Enforce suspension on active sessions, not just login
--
-- Found while auditing: is_admin() and the customer-facing RPC functions
-- never checked is_active. Suspension only blocked a *new* login attempt —
-- someone already signed in when suspended could keep approving
-- transactions (if admin) or keep exchanging/topping up (if customer) until
-- their session naturally expired. This closes that gap at the database
-- level, which is the only place it can be enforced reliably regardless of
-- which client or session is calling.
--
-- HOW TO USE: Supabase dashboard → SQL Editor → New query → paste → Run
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'super_admin') and is_active = true
  );
$$ language sql security definer stable set search_path = public;

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
  v_active boolean;
begin
  select is_active into v_active from users where id = auth.uid();
  if not coalesce(v_active, false) then
    raise exception 'This account has been suspended';
  end if;

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

create or replace function simulate_wallet_topup(p_wallet_id uuid, p_amount numeric)
returns wallets as $$
declare
  v_wallet wallets%rowtype;
  v_active boolean;
begin
  select is_active into v_active from users where id = auth.uid();
  if not coalesce(v_active, false) then
    raise exception 'This account has been suspended';
  end if;

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
