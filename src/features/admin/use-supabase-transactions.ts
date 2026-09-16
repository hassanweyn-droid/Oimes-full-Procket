// ─────────────────────────────────────────────────────────────────────────────
// OIMES — useSupabaseTransactions (admin)
// Fetches every transaction (RLS's admin_full_access_transactions policy
// allows this for role admin/super_admin) and stays live via realtime.
// approve/deny call the atomic Postgres RPC functions from
// supabase/006_transactions_and_escrow_rpc.sql — using supabaseAdmin
// specifically, since approve_transaction()/deny_transaction() check
// is_admin() against *this* session's auth.uid(). Calling them from the
// plain customer `supabase` client (or a session-less client) would fail
// that check even for a real admin account.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabaseAdmin } from '../../lib/supabase';
import type { Transaction, TransactionStatus, MobileMoneyPlatform } from '../../types';

interface TransactionRow {
  id: string;
  reference: string;
  user_id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  from_platform: MobileMoneyPlatform;
  to_platform: MobileMoneyPlatform;
  from_amount: number;
  to_amount: number;
  rate_applied: number;
  rate_spread: number;
  fee_total: number;
  status: TransactionStatus;
  failure_reason: string | null;
  description: string | null;
  initiated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  from_phone: string | null;
  from_display_name: string | null;
  to_phone: string | null;
  to_display_name: string | null;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: 'exchange',
    status: row.status,
    fromWallet: {
      walletId: row.from_wallet_id,
      platform: row.from_platform,
      phoneNumber: row.from_phone ?? '',
      displayName: row.from_display_name ?? undefined,
    },
    toWallet: {
      walletId: row.to_wallet_id,
      platform: row.to_platform,
      phoneNumber: row.to_phone ?? '',
      displayName: row.to_display_name ?? undefined,
    },
    fromAmount: { amount: Number(row.from_amount), currency: 'USD' },
    toAmount: { amount: Number(row.to_amount), currency: 'USD' },
    exchangeRate: {
      fromPlatform: row.from_platform,
      toPlatform: row.to_platform,
      rate: Number(row.rate_applied),
      spread: Number(row.rate_spread),
      capturedAt: row.initiated_at,
    },
    fee: {
      gatewayFee: { amount: Number(row.fee_total), currency: 'USD' },
      serviceFee: { amount: 0, currency: 'USD' },
      total: { amount: Number(row.fee_total), currency: 'USD' },
    },
    reference: row.reference,
    failureReason: row.failure_reason ?? undefined,
    description: row.description ?? undefined,
    initiatedAt: row.initiated_at,
    completedAt: row.completed_at ?? undefined,
    failedAt: row.failed_at ?? undefined,
  };
}

export function useSupabaseTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .order('initiated_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError('');
      setTransactions((data as TransactionRow[]).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabaseAdmin
      .channel('admin-transactions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => refresh())
      .subscribe();
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [refresh]);

  const approveTransaction = useCallback(async (transactionId: string): Promise<void> => {
    const { error: rpcError } = await supabaseAdmin.rpc('approve_transaction', { p_transaction_id: transactionId });
    if (rpcError) throw new Error(rpcError.message);
    // Realtime subscription above refreshes both the list and (via the
    // customer's own wallets subscription) their balances.
  }, []);

  const denyTransaction = useCallback(async (transactionId: string, reason?: string): Promise<void> => {
    const { error: rpcError } = await supabaseAdmin.rpc('deny_transaction', {
      p_transaction_id: transactionId,
      p_reason: reason ?? null,
    });
    if (rpcError) throw new Error(rpcError.message);
  }, []);

  return { transactions, loading, error, approveTransaction, denyTransaction, refresh };
}
