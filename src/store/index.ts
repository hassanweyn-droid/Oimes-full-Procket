// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Global State Store
// Zustand 5.x + Immer 11.x
// Single responsibility: store shape definition and action implementations.
// Platform data → platform-data.ts  |  Mock data → mock-data.ts  |  Selectors → selectors.ts
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import { syncStoreAcrossTabs } from '../lib/cross-tab-sync';
import { supabase } from '../lib/supabase';
import type {
  ExchangeParams,
  ExchangeRate,
  ExchangeResult,
  FeeBreakdown,
  MobileMoneyPlatform,
  Notification,
  NotificationCategory,
  NotificationType,
  Transaction,
  TransactionStatus,
  UserProfile,
  Wallet,
  WalletStatus,
} from '../types';
import { PLATFORM_METADATA, OIMESExchangeError } from './platform-data';
import {
  round2,
  usd,
  nowISO,
  MOCK_USER,
  MOCK_EXCHANGE_RATES,
  SEED_TRANSACTIONS,
  SEED_NOTIFICATIONS,
} from './mock-data';

// ─── Re-export for consumers that imported from store/index previously ─────────

export { PLATFORM_METADATA, OIMESExchangeError } from './platform-data';
export * from './selectors';

// ─── Store Shape ──────────────────────────────────────────────────────────────

export interface OIMESState {
  // ── Domain ──────────────────────────────────────────────────────────
  user: UserProfile;
  exchangeRates: ExchangeRate[];
  transactions: Transaction[];
  notifications: Notification[];

  // ── Session ─────────────────────────────────────────────────────────
  /** Running USD total sent today. Resets at midnight UTC. */
  dailySpentUSD: number;
  /** Premium tier daily limit in USD. */
  readonly dailyLimitUSD: number;

  // ── Actions ──────────────────────────────────────────────────────────
  executeExchange: (params: ExchangeParams) => Promise<ExchangeResult>;
  setDefaultWallet: (walletId: string) => Promise<void>;
  toggleWalletActive: (walletId: string) => Promise<void>;
  /** Links a new mobile-money wallet to the user's account and returns it.
   *  Newly-linked wallets seed with a $0 balance and become the default
   *  send wallet only if this is the user's first wallet. */
  addWallet: (platform: MobileMoneyPlatform, phoneNumber: string, displayName?: string) => Promise<Wallet>;
  /** Unlinks a wallet. Throws if it's the user's only wallet, or if it has
   *  a non-zero balance (must be emptied via exchange first). */
  removeWallet: (walletId: string) => Promise<void>;
  /** Replaces user.wallets wholesale — used by useWalletsSync to hydrate
   *  from Supabase on login and on every realtime change. */
  /** Syncs the real authenticated profile (from auth-store) into this
   *  store's user.id/email/etc — without this, user.id stays the seeded
   *  mock id and every Supabase insert that uses it (wallets, transactions)
   *  fails with "invalid input syntax for type uuid". Preserves whatever
   *  wallets are already loaded. */
  setUser: (profile: UserProfile) => void;
  setWallets: (wallets: Wallet[]) => void;
  /** Hydrates exchangeRates from Supabase (rates are global, not per-user). */
  setExchangeRates: (rates: ExchangeRate[]) => void;
  /** Hydrates notifications from Supabase. */
  setNotifications: (notifications: Notification[]) => void;
  /** Replaces transactions wholesale — used by useTransactionsSync to
   *  hydrate from Supabase on login and on every realtime change. */
  setTransactions: (transactions: Transaction[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  pushNotification: (
    type: NotificationType,
    category: NotificationCategory,
    title: string,
    message: string,
    options?: Partial<Pick<Notification, 'isActionRequired' | 'action' | 'relatedEntity'>>
  ) => void;
}

// ─── Wallets ⇄ Supabase mapping ────────────────────────────────────────────────
// The `wallets` table (see supabase/schema.sql + 005_extend_wallets.sql) is
// the real source of truth once a user is signed in for real. These helpers
// convert between its snake_case rows and the Wallet shape the rest of the
// app already expects, and give the app a way to hydrate + subscribe.

interface WalletRow {
  id: string;
  user_id: string;
  platform: MobileMoneyPlatform;
  phone_number: string | null;
  display_name: string | null;
  balance: number;
  currency: string;
  is_verified: boolean;
  is_default: boolean;
  status: WalletStatus;
  created_at: string;
  updated_at: string;
}

function mapWalletRow(row: WalletRow): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    phoneNumber: row.phone_number ?? '',
    displayName: row.display_name ?? undefined,
    balance: { amount: Number(row.balance), currency: row.currency },
    isDefault: row.is_default,
    isVerified: row.is_verified,
    status: row.status,
    lastSyncedAt: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fetches every wallet linked to a user. Call on login and pass the result
 *  to useOIMESStore.getState().setWallets(...). */
export async function fetchWalletsForUser(userId: string): Promise<Wallet[]> {
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId);
  if (error) {
    console.error('[OIMES] fetchWalletsForUser failed:', error.message);
    return [];
  }
  if (!data) return [];
  return (data as WalletRow[]).map(mapWalletRow);
}

/** Subscribes to live wallet changes for one user (e.g. a balance update
 *  after an admin approves a transaction). Returns an unsubscribe function. */
export function subscribeToWallets(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`wallets-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

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
  initiated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  from_phone: string | null;
  from_display_name: string | null;
  to_phone: string | null;
  to_display_name: string | null;
  description: string | null;
}

function mapTransactionRow(row: TransactionRow): Transaction {
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

/** Fetches every transaction belonging to one user (customer-side use). */
export async function fetchTransactionsForUser(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('initiated_at', { ascending: false });
  if (error) {
    console.error('[OIMES] fetchTransactionsForUser failed:', error.message);
    return [];
  }
  if (!data) return [];
  return (data as TransactionRow[]).map(mapTransactionRow);
}

/** Live updates for one user's transactions — e.g. an admin approving one
 *  flips it from pending to completed on the customer's own History view. */
export function subscribeToTransactions(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`transactions-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

interface ExchangeRateRow {
  id: string;
  from_platform: MobileMoneyPlatform;
  to_platform: MobileMoneyPlatform;
  rate: number;
  fee_percent: number;
  updated_at: string;
}

function mapExchangeRateRow(row: ExchangeRateRow): ExchangeRate {
  return {
    id: row.id,
    fromPlatform: row.from_platform,
    toPlatform: row.to_platform,
    rate: Number(row.rate),
    inverseRate: 1 / Number(row.rate),
    spread: Number(row.fee_percent),
    fetchedAt: row.updated_at,
    expiresAt: row.updated_at,
    source: 'live',
  };
}

/** Fetches every rate pair. Rates are global (not per-user), so this can be
 *  called as soon as someone is signed in, regardless of who they are. */
export async function fetchExchangeRates(): Promise<ExchangeRate[]> {
  const { data, error } = await supabase.from('exchange_rates').select('*');
  if (error) {
    console.error('[OIMES] fetchExchangeRates failed:', error.message);
    return [];
  }
  if (!data) return [];
  return (data as ExchangeRateRow[]).map(mapExchangeRateRow);
}

/** Live updates when an admin edits a rate. */
export function subscribeToExchangeRates(onChange: () => void): () => void {
  const channel = supabase
    .channel('exchange-rates-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exchange_rates' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  is_read: boolean;
  is_action_required: boolean;
  related_entity: { type: string; id: string } | null;
  created_at: string;
}

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    category: row.category,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    isActionRequired: row.is_action_required,
    relatedEntity: row.related_entity
      ? { type: row.related_entity.type as 'transaction' | 'kyc' | 'wallet', id: row.related_entity.id }
      : undefined,
    createdAt: row.created_at,
  };
}

export async function fetchNotificationsForUser(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('[OIMES] fetchNotificationsForUser failed:', error.message);
    return [];
  }
  if (!data) return [];
  return (data as NotificationRow[]).map(mapNotificationRow);
}

export function subscribeToNotifications(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────
//
// Persisted to localStorage (and synced live across browser tabs — see
// lib/cross-tab-sync.ts) so that a transaction a customer creates in one tab
// shows up as "pending" in the admin dashboard open in another tab, and the
// admin's approve/deny decision flows straight back to the customer's history
// view without either side needing to refresh.

const OIMES_DATA_STORAGE_KEY = 'oimes-data';

export const useOIMESStore = create<OIMESState>()(
  devtools(
    persist(
      immer((set, get) => ({
      // ── Initial State ─────────────────────────────────────────────────

      user: MOCK_USER,
      exchangeRates: MOCK_EXCHANGE_RATES,
      transactions: SEED_TRANSACTIONS,
      notifications: SEED_NOTIFICATIONS,
      dailySpentUSD: 1_450, // $500 + $700 + $250 from seed transactions
      dailyLimitUSD: 10_000, // Premium user tier

      // ── executeExchange ───────────────────────────────────────────────
      //
      //  Pipeline:
      //    1. Resolve wallets from IDs
      //    2. Validate state (platform, status, balance, daily limit, amounts)
      //    3. Resolve live exchange rate
      //    4. Calculate gateway fee + received amount
      //    5. Build immutable transaction record
      //    6. Atomically commit: debit · credit · ledger · daily tracker · notification

      executeExchange: async ({ fromWalletId, toWalletId, fromAmount, description }) => {
        const { user, exchangeRates, dailySpentUSD, dailyLimitUSD } = get();

        // 1. Resolve wallets
        const fromWallet = user.wallets.find((w) => w.id === fromWalletId);
        const toWallet = user.wallets.find((w) => w.id === toWalletId);

        if (!fromWallet || !toWallet) {
          throw new OIMESExchangeError('WALLET_NOT_FOUND');
        }

        // 2. Validate
        if (fromWallet.platform === toWallet.platform) {
          throw new OIMESExchangeError(
            'SAME_PLATFORM_EXCHANGE',
            `Both wallets are on ${PLATFORM_METADATA[fromWallet.platform].displayName}. Use a peer transfer instead.`
          );
        }
        if (fromWallet.status !== 'active') {
          throw new OIMESExchangeError('WALLET_SUSPENDED', `Source wallet is ${fromWallet.status}.`);
        }
        if (toWallet.status !== 'active') {
          throw new OIMESExchangeError('WALLET_SUSPENDED', `Destination wallet is ${toWallet.status}.`);
        }

        const fromMeta = PLATFORM_METADATA[fromWallet.platform];

        if (fromAmount < fromMeta.transferLimits.min) {
          throw new OIMESExchangeError(
            'AMOUNT_BELOW_MINIMUM',
            `Minimum transfer on ${fromMeta.displayName} is $${fromMeta.transferLimits.min}.`
          );
        }
        if (fromAmount > fromMeta.transferLimits.max) {
          throw new OIMESExchangeError(
            'AMOUNT_ABOVE_MAXIMUM',
            `Single transfer limit on ${fromMeta.displayName} is $${fromMeta.transferLimits.max}.`
          );
        }
        if (fromWallet.balance.amount < fromAmount) {
          throw new OIMESExchangeError(
            'INSUFFICIENT_BALANCE',
            `Balance on ${fromMeta.displayName} is $${fromWallet.balance.amount.toFixed(2)}.`
          );
        }
        if (dailySpentUSD + fromAmount > dailyLimitUSD) {
          const remaining = round2(dailyLimitUSD - dailySpentUSD);
          throw new OIMESExchangeError(
            'DAILY_LIMIT_EXCEEDED',
            `Daily limit reached. Remaining capacity: $${remaining.toFixed(2)}.`
          );
        }

        // 3. Resolve exchange rate
        const rate = exchangeRates.find(
          (r) => r.fromPlatform === fromWallet.platform && r.toPlatform === toWallet.platform
        );

        if (!rate) {
          throw new OIMESExchangeError(
            'RATE_NOT_AVAILABLE',
            `No active rate for ${fromMeta.displayName} → ${PLATFORM_METADATA[toWallet.platform].displayName}.`
          );
        }

        // 4. Calculate fee + received amount
        //    gatewayFee = fromAmount × spread
        //    serviceFee = 0 (waived for premium KYC-verified users)
        //    received   = (fromAmount − totalFee) × rate
        const gatewayFeeAmount = round2(fromAmount * rate.spread);
        const serviceFeeAmount = 0;
        const totalFeeAmount = round2(gatewayFeeAmount + serviceFeeAmount);
        const netAmount = round2(fromAmount - totalFeeAmount);
        const receivedAmount = round2(netAmount * rate.rate);

        const fee: FeeBreakdown = {
          gatewayFee: usd(gatewayFeeAmount),
          serviceFee: usd(serviceFeeAmount),
          total: usd(totalFeeAmount),
        };

        // 5. Commit via the escrow RPC (supabase/008_..._escrow_notifications.sql).
        //    This atomically: debits fromWallet, credits the platform's escrow
        //    balance, and inserts the 'pending' transaction row — the real
        //    "lock" phase of Chapter 3.4.3's escrow pattern. A database
        //    trigger creates the "Transaction Submitted" notification, so we
        //    don't need to push one from here.
        const { data, error } = await supabase.rpc('create_exchange_transaction', {
          p_from_wallet_id: fromWallet.id,
          p_to_wallet_id: toWallet.id,
          p_from_amount: fromAmount,
          p_to_amount: receivedAmount,
          p_rate: rate.rate,
          p_spread: rate.spread,
          p_fee_total: totalFeeAmount,
          p_description: description?.trim() || null,
        });

        if (error || !data) {
          throw new OIMESExchangeError('RATE_NOT_AVAILABLE', error?.message ?? 'Could not submit this transaction. Please try again.');
        }

        const transaction = mapTransactionRow(data as TransactionRow);

        // 6. Reflect locally. The wallets realtime subscription (App.tsx)
        // will also pick up the debit, but updating it here too means the
        // UI doesn't wait a round trip to show the new balance.
        set((draft) => {
          draft.transactions.unshift(transaction);
          draft.dailySpentUSD = round2(draft.dailySpentUSD + fromAmount);
          const fromIdx = draft.user.wallets.findIndex((w) => w.id === fromWallet.id);
          if (fromIdx !== -1) {
            draft.user.wallets[fromIdx].balance.amount = round2(draft.user.wallets[fromIdx].balance.amount - fromAmount);
          }
        });

        return { transaction, receivedAmount: usd(receivedAmount), fee };
      },

      // ── setDefaultWallet ──────────────────────────────────────────────

      setDefaultWallet: async (walletId) => {
        const prevDefault = get().user.wallets.find((w) => w.isDefault)?.id;
        set((draft) => {
          for (const wallet of draft.user.wallets) {
            wallet.isDefault = wallet.id === walletId;
          }
        });
        try {
          if (prevDefault && prevDefault !== walletId) {
            await supabase.from('wallets').update({ is_default: false }).eq('id', prevDefault);
          }
          await supabase.from('wallets').update({ is_default: true }).eq('id', walletId);
        } catch {
          // Best-effort — the local UI already updated; the wallets realtime
          // subscription will correct this if the write actually failed.
        }
      },

      // ── toggleWalletActive ────────────────────────────────────────────

      toggleWalletActive: async (walletId) => {
        const w = get().user.wallets.find((wl) => wl.id === walletId);
        if (!w) return;
        const nextStatus = w.status === 'active' ? 'suspended' : 'active';
        set((draft) => {
          const wl = draft.user.wallets.find((x) => x.id === walletId);
          if (wl) {
            wl.status = nextStatus;
            wl.updatedAt = nowISO();
          }
        });
        try {
          await supabase.from('wallets').update({ status: nextStatus }).eq('id', walletId);
        } catch {
          // Best-effort, see note above.
        }
      },

      // ── addWallet ─────────────────────────────────────────────────────
      //  Links a new mobile-money wallet — this is what powers "Add wallet
      //  account → Choose provider" in Profile. Inserts into Supabase first,
      //  then reflects the real row (real id, real timestamps) into
      //  user.wallets so it immediately shows up in the Wallets tab and
      //  becomes selectable in the Exchange dropdowns.

      addWallet: async (platform, phoneNumber, displayName) => {
        const normalized = phoneNumber.trim();

        if (!/^\+?\d{7,15}$/.test(normalized.replace(/[\s-]/g, ''))) {
          throw new OIMESExchangeError('INVALID_PHONE_NUMBER', 'Enter a valid phone number.');
        }

        const { user } = get();
        const cleaned = normalized.replace(/[\s-]/g, '');
        const duplicate = user.wallets.some(
          (w) => w.platform === platform && w.phoneNumber.replace(/[\s-]/g, '') === cleaned
        );
        if (duplicate) {
          throw new OIMESExchangeError(
            'WALLET_ALREADY_LINKED',
            `This ${PLATFORM_METADATA[platform].displayName} number is already linked.`
          );
        }

        const meta = PLATFORM_METADATA[platform];
        const isFirstWallet = user.wallets.length === 0;

        const { data, error } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            platform,
            phone_number: normalized,
            display_name: displayName?.trim() || `${meta.displayName} — Linked`,
            balance: 0,
            currency: 'USD',
            is_verified: true,
            is_default: isFirstWallet,
            status: 'active',
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') {
            throw new OIMESExchangeError('WALLET_ALREADY_LINKED', `This ${meta.displayName} number is already linked.`);
          }
          throw new OIMESExchangeError('WALLET_NOT_FOUND', error.message);
        }

        const wallet = mapWalletRow(data as WalletRow);

        set((draft) => {
          draft.user.wallets.push(wallet);
        });

        get().pushNotification(
          'success',
          'system',
          'Wallet Linked',
          `${meta.displayName} (${normalized}) is now linked and ready to use for exchanges.`,
          { relatedEntity: { type: 'wallet', id: wallet.id } }
        );

        return wallet;
      },

      // ── removeWallet ──────────────────────────────────────────────────

      removeWallet: async (walletId) => {
        const { user } = get();
        const wallet = user.wallets.find((w) => w.id === walletId);
        if (!wallet) throw new OIMESExchangeError('WALLET_NOT_FOUND');
        if (user.wallets.length === 1) {
          throw new OIMESExchangeError('LAST_WALLET', 'You must keep at least one linked wallet.');
        }
        if (wallet.balance.amount > 0) {
          throw new OIMESExchangeError(
            'WALLET_HAS_BALANCE',
            `Transfer the $${wallet.balance.amount.toFixed(2)} balance out before removing this wallet.`
          );
        }

        const { error } = await supabase.from('wallets').delete().eq('id', walletId);
        if (error) throw new OIMESExchangeError('WALLET_NOT_FOUND', error.message);

        set((draft) => {
          draft.user.wallets = draft.user.wallets.filter((w) => w.id !== walletId);
          if (wallet.isDefault && draft.user.wallets.length > 0) {
            draft.user.wallets[0].isDefault = true;
          }
        });
      },

      // ── setWallets ─────────────────────────────────────────────────────
      //  Hydrates user.wallets from Supabase — called by useWalletsSync on
      //  login and whenever the realtime subscription sees a change.

      setUser: (profile) => {
        set((draft) => {
          const existingWallets = draft.user.wallets;
          draft.user = { ...profile, wallets: existingWallets };
        });
      },

      setWallets: (wallets) => {
        set((draft) => {
          draft.user.wallets = wallets;
        });
      },

      setExchangeRates: (rates) => {
        set((draft) => {
          draft.exchangeRates = rates;
        });
      },

      setNotifications: (notifications) => {
        set((draft) => {
          draft.notifications = notifications;
        });
      },

      setTransactions: (transactions) => {
        const todayKey = new Date().toDateString();
        const spentToday = transactions
          .filter((t) => (t.status === 'pending' || t.status === 'completed') && new Date(t.initiatedAt).toDateString() === todayKey)
          .reduce((sum, t) => sum + t.fromAmount.amount, 0);
        set((draft) => {
          draft.transactions = transactions;
          draft.dailySpentUSD = round2(spentToday);
        });
      },

      // ── Notification Actions ──────────────────────────────────────────

      markNotificationRead: (id) => {
        set((draft) => {
          const notif = draft.notifications.find((n) => n.id === id);
          if (notif && !notif.isRead) {
            notif.isRead = true;
            notif.readAt = nowISO();
          }
        });
        supabase.from('notifications').update({ is_read: true }).eq('id', id).then(() => {});
      },

      markAllNotificationsRead: () => {
        const now = nowISO();
        const { user } = get();
        set((draft) => {
          for (const notif of draft.notifications) {
            if (!notif.isRead) {
              notif.isRead = true;
              notif.readAt = now;
            }
          }
        });
        supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false).then(() => {});
      },

      dismissNotification: (id) => {
        set((draft) => {
          draft.notifications = draft.notifications.filter((n) => n.id !== id);
        });
        supabase.from('notifications').delete().eq('id', id).then(() => {});
      },

      pushNotification: (type, category, title, message, options = {}) => {
        const now = nowISO();
        set((draft) => {
          draft.notifications.unshift({
            id: `notif_${Date.now()}`,
            userId: draft.user.id,
            type,
            category,
            title,
            message,
            isRead: false,
            isActionRequired: options.isActionRequired ?? false,
            action: options.action,
            relatedEntity: options.relatedEntity,
            createdAt: now,
          });
        });
      },
    })),
      {
        name: OIMES_DATA_STORAGE_KEY,
        partialize: (s) => ({
          user: s.user,
          exchangeRates: s.exchangeRates,
          transactions: s.transactions,
          notifications: s.notifications,
          dailySpentUSD: s.dailySpentUSD,
        }),
      }
    ),
    { name: 'OIMES', serialize: { options: true } }
  )
);

syncStoreAcrossTabs(OIMES_DATA_STORAGE_KEY, useOIMESStore);
