// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Mock / Seed Data
// Single responsibility: development fixtures only.
// All helpers here are pure functions with no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ExchangeRate,
  MobileMoneyPlatform,
  Notification,
  Transaction,
  UserProfile,
  Wallet,
} from '../types';

// ─── Pure arithmetic helpers ──────────────────────────────────────────────────

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function usd(amount: number) {
  return { amount: round2(amount), currency: 'USD' };
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function generateTxRef(): string {
  const ts = Date.now();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TX-OIMES-${ts}-${suffix}`;
}

// ─── Seed constants ───────────────────────────────────────────────────────────

const MOCK_USER_ID = 'usr_hassan_weyn_001';
const BASE_DATE = '2026-01-15T09:00:00.000Z';

// ─── Mock Wallets ─────────────────────────────────────────────────────────────

export const MOCK_WALLETS: Wallet[] = [
  {
    id: 'wlt_evc_hassan',
    userId: MOCK_USER_ID,
    platform: 'evc_plus',
    phoneNumber: '+252615001234',
    displayName: 'EVC Plus — Personal',
    balance: usd(1_250.00),
    isDefault: true,
    isVerified: true,
    status: 'active',
    lastSyncedAt: BASE_DATE,
    createdAt: '2025-03-10T08:00:00.000Z',
    updatedAt: BASE_DATE,
  },
  {
    id: 'wlt_zaad_hassan',
    userId: MOCK_USER_ID,
    platform: 'zaad',
    phoneNumber: '+252634005678',
    displayName: 'Zaad — Business',
    balance: usd(850.00),
    isDefault: false,
    isVerified: true,
    status: 'active',
    lastSyncedAt: BASE_DATE,
    createdAt: '2025-03-10T08:05:00.000Z',
    updatedAt: BASE_DATE,
  },
  {
    id: 'wlt_sahal_hassan',
    userId: MOCK_USER_ID,
    platform: 'sahal',
    phoneNumber: '+252909002345',
    displayName: 'Sahal — Secondary',
    balance: usd(320.00),
    isDefault: false,
    isVerified: true,
    status: 'active',
    lastSyncedAt: BASE_DATE,
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: BASE_DATE,
  },
  {
    id: 'wlt_edahab_hassan',
    userId: MOCK_USER_ID,
    platform: 'edahab',
    phoneNumber: '+252678003456',
    displayName: 'eDahab — Savings',
    balance: usd(2_100.00),
    isDefault: false,
    isVerified: true,
    status: 'active',
    lastSyncedAt: BASE_DATE,
    createdAt: '2025-09-20T12:00:00.000Z',
    updatedAt: BASE_DATE,
  },
];

// ─── Mock User ────────────────────────────────────────────────────────────────

export const MOCK_USER: UserProfile = {
  id: MOCK_USER_ID,
  email: 'hassan.weyn@oimes.so',
  phone: '+252615001234',
  firstName: 'Hassan',
  lastName: 'Weyn',
  displayName: 'Hassan Weyn',
  dateOfBirth: '1988-04-22',
  identity: {
    type: 'national_id',
    number: 'SO-NID-8804220012',
    expiresAt: '2029-04-22',
  },
  address: {
    city: 'Mogadishu',
    region: 'Banaadir',
    district: 'Hodan',
    country: 'SO',
  },
  role: 'customer',
  kycStatus: 'verified',
  kycVerifiedAt: '2025-03-12T14:30:00.000Z',
  wallets: MOCK_WALLETS,
  preferredPlatform: 'evc_plus',
  preferredCurrency: 'USD',
  isActive: true,
  isEmailVerified: true,
  isPhoneVerified: true,
  twoFactorEnabled: true,
  lastLoginAt: BASE_DATE,
  createdAt: '2025-03-10T08:00:00.000Z',
  updatedAt: BASE_DATE,
  preferences: {
    language: 'so',
    theme: 'light',
    defaultSendAmount: 100,
    notifications: {
      email: true,
      sms: true,
      push: true,
      transactionAlerts: true,
      rateAlerts: true,
      marketing: false,
    },
  },
};

// ─── Exchange Rate Matrix ─────────────────────────────────────────────────────
//
//  All platforms settle in USD. Rates are 1:1 with spread capturing the
//  gateway interoperability fee. Spread range: 1.0% – 1.5%.

const RATE_EXPIRY = new Date(Date.now() + 5 * 60 * 1_000).toISOString(); // +5 min

type RatePair = [MobileMoneyPlatform, MobileMoneyPlatform, number];

const RATE_PAIRS: RatePair[] = [
  ['evc_plus', 'zaad',   0.010],
  ['evc_plus', 'sahal',  0.012],
  ['evc_plus', 'edahab', 0.013],
  ['zaad',   'evc_plus', 0.010],
  ['zaad',   'sahal',    0.012],
  ['zaad',   'edahab',   0.013],
  ['sahal',  'evc_plus', 0.012],
  ['sahal',  'zaad',     0.012],
  ['sahal',  'edahab',   0.015],
  ['edahab', 'evc_plus', 0.013],
  ['edahab', 'zaad',     0.013],
  ['edahab', 'sahal',    0.015],
];

export const MOCK_EXCHANGE_RATES: ExchangeRate[] = RATE_PAIRS.map(
  ([from, to, spread]) => ({
    id: `rate_${from}_${to}`,
    fromPlatform: from,
    toPlatform: to,
    rate: 1.0,
    inverseRate: 1.0,
    spread,
    fetchedAt: BASE_DATE,
    expiresAt: RATE_EXPIRY,
    source: 'live' as const,
  })
);

// ─── Seed Notifications ───────────────────────────────────────────────────────

export const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_welcome_001',
    userId: MOCK_USER_ID,
    type: 'success',
    category: 'kyc',
    title: 'Identity Verified',
    message: 'Your KYC documents have been approved. You now have full access to all OIMES features.',
    isRead: true,
    readAt: '2025-03-12T15:00:00.000Z',
    isActionRequired: false,
    createdAt: '2025-03-12T14:30:00.000Z',
  },
  {
    id: 'notif_rate_alert_001',
    userId: MOCK_USER_ID,
    type: 'info',
    category: 'exchange_rate',
    title: 'Rate Alert',
    message: 'EVC Plus → eDahab gateway fee dropped to 1.3%. A good time to exchange.',
    isRead: false,
    isActionRequired: false,
    createdAt: BASE_DATE,
  },
];

// ─── Seed Transactions ────────────────────────────────────────────────────────
//  Three representative historical exchanges covering today's $1,450 spend.
//  Stored newest-first to match the prepend logic in executeExchange.

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn_seed_003',
    userId: MOCK_USER_ID,
    type: 'exchange',
    status: 'pending',
    fromWallet: {
      walletId: 'wlt_zaad_hassan',
      platform: 'zaad',
      phoneNumber: '+252634005678',
      displayName: 'Zaad — Business',
    },
    toWallet: {
      walletId: 'wlt_sahal_hassan',
      platform: 'sahal',
      phoneNumber: '+252909002345',
      displayName: 'Sahal — Secondary',
    },
    fromAmount: usd(250.00),
    toAmount: usd(247.00),
    exchangeRate: {
      fromPlatform: 'zaad',
      toPlatform: 'sahal',
      rate: 1.0,
      spread: 0.012,
      capturedAt: '2026-01-15T08:20:00.000Z',
    },
    fee: { gatewayFee: usd(3.00), serviceFee: usd(0), total: usd(3.00) },
    reference: 'TX-OIMES-1736930400000-C9P5R2',
    description: 'Exchange from Zaad to Sahal',
    initiatedAt: '2026-01-15T08:20:00.000Z',
  },
  {
    id: 'txn_seed_002',
    userId: MOCK_USER_ID,
    type: 'exchange',
    status: 'completed',
    fromWallet: {
      walletId: 'wlt_evc_hassan',
      platform: 'evc_plus',
      phoneNumber: '+252615001234',
      displayName: 'EVC Plus — Personal',
    },
    toWallet: {
      walletId: 'wlt_edahab_hassan',
      platform: 'edahab',
      phoneNumber: '+252678003456',
      displayName: 'eDahab — Savings',
    },
    fromAmount: usd(700.00),
    toAmount: usd(690.90),
    exchangeRate: {
      fromPlatform: 'evc_plus',
      toPlatform: 'edahab',
      rate: 1.0,
      spread: 0.013,
      capturedAt: '2026-01-15T07:30:00.000Z',
    },
    fee: { gatewayFee: usd(9.10), serviceFee: usd(0), total: usd(9.10) },
    reference: 'TX-OIMES-1736927400000-B7M4X1',
    description: 'Exchange from EVC Plus to eDahab',
    initiatedAt: '2026-01-15T07:30:00.000Z',
    completedAt: '2026-01-15T07:30:42.000Z',
  },
  {
    id: 'txn_seed_001',
    userId: MOCK_USER_ID,
    type: 'exchange',
    status: 'completed',
    fromWallet: {
      walletId: 'wlt_evc_hassan',
      platform: 'evc_plus',
      phoneNumber: '+252615001234',
      displayName: 'EVC Plus — Personal',
    },
    toWallet: {
      walletId: 'wlt_zaad_hassan',
      platform: 'zaad',
      phoneNumber: '+252634005678',
      displayName: 'Zaad — Business',
    },
    fromAmount: usd(500.00),
    toAmount: usd(495.00),
    exchangeRate: {
      fromPlatform: 'evc_plus',
      toPlatform: 'zaad',
      rate: 1.0,
      spread: 0.010,
      capturedAt: '2026-01-15T06:20:00.000Z',
    },
    fee: { gatewayFee: usd(5.00), serviceFee: usd(0), total: usd(5.00) },
    reference: 'TX-OIMES-1736922000000-A3F2K9',
    description: 'Exchange from EVC Plus to Zaad',
    initiatedAt: '2026-01-15T06:20:00.000Z',
    completedAt: '2026-01-15T06:20:38.000Z',
  },
];
