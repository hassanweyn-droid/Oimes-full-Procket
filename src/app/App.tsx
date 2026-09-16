// ─────────────────────────────────────────────────────────────────────────────
// OIMES — App
// Root component. Gates on auth: shows AuthShell when logged out,
// MainLayout + feature views when logged in.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MainLayout } from '../components/layout/MainLayout';
import type { NavItemId } from '../components/layout/MainLayout';
import { DashboardView }  from '../features/dashboard/DashboardView';
import { ExchangeView }   from '../features/exchange/ExchangeView';
import { WalletsView }    from '../features/wallets/WalletsView';
import { HistoryView }    from '../features/history/HistoryView';
import { ProfileView }    from '../features/auth/ProfileView';
import { AuthShell }      from '../features/auth/AuthShell';
import { useAuthStore, selectIsAuthenticated, selectCurrentUser } from '../features/auth/auth-store';
import { supabase } from '../lib/supabase';
import {
  useOIMESStore,
  fetchWalletsForUser, subscribeToWallets,
  fetchTransactionsForUser, subscribeToTransactions,
  fetchExchangeRates, subscribeToExchangeRates,
  fetchNotificationsForUser, subscribeToNotifications,
} from '../store/index';

function renderView(nav: NavItemId) {
  switch (nav) {
    case 'exchange':     return <ExchangeView />;
    case 'wallets':      return <WalletsView />;
    case 'transactions': return <HistoryView />;
    case 'settings':     return <ProfileView />;
    default:             return <DashboardView />;
  }
}

export default function App() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const currentUser = useAuthStore(selectCurrentUser);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useOIMESStore((s) => s.setUser);
  const setWallets = useOIMESStore((s) => s.setWallets);
  const setTransactions = useOIMESStore((s) => s.setTransactions);
  const setExchangeRates = useOIMESStore((s) => s.setExchangeRates);
  const setNotifications = useOIMESStore((s) => s.setNotifications);
  const [activeNav, setActiveNav] = useState<NavItemId>('dashboard');

  // If an admin suspends this account while they're mid-session, sign them
  // out immediately instead of waiting for their next login attempt — the
  // database already blocks any privileged action the instant this happens
  // (see supabase/010_enforce_suspension.sql); this just makes the UI match.
  useEffect(() => {
    if (!currentUser?.id) return;
    const channel = supabase
      .channel(`account-status-${currentUser.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${currentUser.id}` },
        (payload) => {
          if (payload.new && (payload.new as { is_active?: boolean }).is_active === false) {
            logout();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, logout]);

  // The rest of the app (wallets, transactions, exchange) reads user.id off
  // useOIMESStore, which starts out seeded with mock data — without this,
  // every Supabase write uses a fake, non-UUID user id and fails.
  useEffect(() => {
    if (currentUser) setUser(currentUser);
  }, [currentUser, setUser]);

  // Hydrate this user's real wallets from Supabase, then keep them live —
  // an admin approving a transaction updates a balance server-side, and this
  // subscription is what makes that show up here without a manual refresh.
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsubscribe: (() => void) | undefined;

    fetchWalletsForUser(currentUser.id).then(setWallets);
    unsubscribe = subscribeToWallets(currentUser.id, () => {
      fetchWalletsForUser(currentUser.id).then(setWallets);
    });

    return () => unsubscribe?.();
  }, [currentUser?.id, setWallets]);

  // Same idea for transactions — a customer's own History/Dashboard view
  // flips from "pending" to "completed"/"failed" live the moment an admin
  // decides, in any tab, on any device.
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsubscribe: (() => void) | undefined;

    fetchTransactionsForUser(currentUser.id).then(setTransactions);
    unsubscribe = subscribeToTransactions(currentUser.id, () => {
      fetchTransactionsForUser(currentUser.id).then(setTransactions);
    });

    return () => unsubscribe?.();
  }, [currentUser?.id, setTransactions]);

  // Exchange rates are global, not per-user — fetch once we know someone's
  // signed in, then stay live so an admin's rate edit shows up immediately.
  // Guard: if Supabase returns zero rows (RLS misconfigured, network hiccup,
  // migration not yet run, etc.), don't wipe out whatever rates are already
  // showing — keep the last good set (or the seeded fallback) instead of
  // breaking Exchange entirely.
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsubscribe: (() => void) | undefined;

    const applyRates = (rates: Awaited<ReturnType<typeof fetchExchangeRates>>) => {
      if (rates.length > 0) setExchangeRates(rates);
      else console.warn('[OIMES] Supabase returned 0 exchange rates — keeping existing rates instead of clearing them.');
    };

    fetchExchangeRates().then(applyRates);
    unsubscribe = subscribeToExchangeRates(() => {
      fetchExchangeRates().then(applyRates);
    });

    return () => unsubscribe?.();
  }, [currentUser?.id, setExchangeRates]);

  // Notifications — mostly created server-side by triggers now (see
  // supabase/008_..._notifications.sql), so this just needs to read + stay live.
  useEffect(() => {
    if (!currentUser?.id) return;
    let unsubscribe: (() => void) | undefined;

    fetchNotificationsForUser(currentUser.id).then(setNotifications);
    unsubscribe = subscribeToNotifications(currentUser.id, () => {
      fetchNotificationsForUser(currentUser.id).then(setNotifications);
    });

    return () => unsubscribe?.();
  }, [currentUser?.id, setNotifications]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isAuthenticated ? (
        <motion.div
          key="auth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AuthShell />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <MainLayout activeNav={activeNav} onNavChange={setActiveNav}>
            {renderView(activeNav)}
          </MainLayout>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
