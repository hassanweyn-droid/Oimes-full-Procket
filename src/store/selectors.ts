// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Zustand Selectors
// Memoisation-friendly narrow-slice selectors.
// Pair with useShallow() in Zustand 5 for object selectors.
// NOTE: Do NOT export a selector that returns a new object literal — it will
// cause useSyncExternalStore to loop infinitely. Select primitives individually.
// ─────────────────────────────────────────────────────────────────────────────

import type { MobileMoneyPlatform } from '../types';
import type { OIMESState } from './index';

export const selectUser = (s: OIMESState) => s.user;
export const selectWallets = (s: OIMESState) => s.user.wallets;
export const selectDefaultWallet = (s: OIMESState) =>
  s.user.wallets.find((w) => w.isDefault) ?? s.user.wallets[0];
export const selectTransactions = (s: OIMESState) => s.transactions;
export const selectExchangeRates = (s: OIMESState) => s.exchangeRates;
export const selectNotifications = (s: OIMESState) => s.notifications;
export const selectUnreadCount = (s: OIMESState) =>
  s.notifications.filter((n) => !n.isRead).length;
export const selectDailySpent = (s: OIMESState) => s.dailySpentUSD;
export const selectDailyLimit = (s: OIMESState) => s.dailyLimitUSD;

export const selectRateBetween =
  (from: MobileMoneyPlatform, to: MobileMoneyPlatform) =>
  (s: OIMESState) =>
    s.exchangeRates.find((r) => r.fromPlatform === from && r.toPlatform === to);
