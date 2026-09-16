// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Mobile Money Exchange System
// Domain type definitions — single source of truth
// React 18 + TypeScript 5.x
// ─────────────────────────────────────────────────────────────────────────────

// ─── § 1. Platform Identity ───────────────────────────────────────────────────

/** Exhaustive tuple of all supported Somali mobile money platforms.
 *  Import this array for runtime exhaustiveness checks. */
export const MOBILE_MONEY_PLATFORMS = [
  'evc_plus',
  'sahal',
  'zaad',
  'edahab',
] as const;

export type MobileMoneyPlatform = (typeof MOBILE_MONEY_PLATFORMS)[number];

// ─── § 2. Currency & Money ────────────────────────────────────────────────────

export interface Currency {
  code: string;     // ISO 4217 — 'USD' | 'SOS'
  symbol: string;   // '$' | 'Sh'
  name: string;
  decimals: number; // significant decimal places (2 for USD, 0 for SOS whole-shilling)
}

/** Typed monetary value. Always carry the currency alongside the amount
 *  to prevent cross-currency arithmetic bugs. */
export interface Money {
  amount: number;
  currency: string; // Currency['code']
}

// ─── § 3. Platform Metadata ───────────────────────────────────────────────────

/** Fee structure — discriminated union enables exhaustive switch rendering. */
export type PlatformFee =
  | { type: 'percentage'; rate: number; cap?: number }
  | { type: 'fixed'; amount: number }
  | { type: 'tiered'; tiers: ReadonlyArray<{ upTo: number; rate: number }> };

export interface PlatformMetadata {
  id: MobileMoneyPlatform;
  displayName: string;       // 'EVC Plus' | 'Sahal' | 'Zaad' | 'eDahab'
  shortCode: string;         // 'EVC' | 'SAH' | 'ZAD' | 'EDB'
  operator: string;          // Telecom operator name
  primaryCurrency: string;   // Currency['code']
  supportedCurrencies: readonly string[];
  brandColor: string;        // Hex — used for platform-specific UI accents
  logoUrl?: string;
  ussdCode?: string;
  transferLimits: {
    min: number;
    max: number;
    dailyMax: number;
  };
  fee: PlatformFee;
  isActive: boolean;
  supportedRegions: readonly string[];
}

// ─── § 4. Wallet ──────────────────────────────────────────────────────────────

export type WalletStatus =
  | 'active'
  | 'suspended'
  | 'closed'
  | 'pending_verification';

export interface Wallet {
  id: string;
  userId: string;
  platform: MobileMoneyPlatform;
  /** E.164 format — e.g. +252615001234 */
  phoneNumber: string;
  displayName?: string;
  balance: Money;
  /** Designated default send-from wallet. Only one per user. */
  isDefault: boolean;
  isVerified: boolean;
  status: WalletStatus;
  lastSyncedAt: string; // ISO 8601
  createdAt: string;
  updatedAt: string;
}

// ─── § 5. Transaction ─────────────────────────────────────────────────────────

export type TransactionType = 'exchange' | 'deposit' | 'withdrawal' | 'transfer';

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'reversed';

/** Denormalized snapshot of wallet state at transaction time.
 *  Ensures historical transactions remain accurate after wallet mutations. */
export interface WalletSnapshot {
  walletId: string;
  platform: MobileMoneyPlatform;
  phoneNumber: string;
  displayName?: string;
}

export interface FeeBreakdown {
  gatewayFee: Money;  // Platform interoperability fee
  serviceFee: Money;  // OIMES service margin (waived for premium)
  total: Money;
}

/** Immutable rate snapshot captured at transaction execution time. */
export interface ExchangeRateSnapshot {
  fromPlatform: MobileMoneyPlatform;
  toPlatform: MobileMoneyPlatform;
  rate: number;
  spread: number; // Gateway fee percentage applied
  capturedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  status: TransactionStatus;
  fromWallet: WalletSnapshot;
  toWallet: WalletSnapshot;
  fromAmount: Money;
  toAmount: Money;
  /** Present for 'exchange' type only. */
  exchangeRate?: ExchangeRateSnapshot;
  fee: FeeBreakdown;
  /** Internal reference — format: TX-OIMES-{timestamp}-{suffix} */
  reference: string;
  /** Counterpart platform's own transaction identifier, if returned. */
  externalReference?: string;
  description?: string;
  failureReason?: string;
  initiatedAt: string;
  completedAt?: string;
  failedAt?: string;
}

// ─── § 6. Exchange Rate ───────────────────────────────────────────────────────

export interface ExchangeRate {
  id: string;
  fromPlatform: MobileMoneyPlatform;
  toPlatform: MobileMoneyPlatform;
  /** Multiplier: toAmount = (fromAmount − fee) × rate */
  rate: number;
  inverseRate: number;
  /** Gateway fee as a decimal fraction — e.g. 0.012 = 1.2% */
  spread: number;
  fetchedAt: string;
  expiresAt: string;
  source: 'live' | 'cached' | 'manual';
}

// ─── § 7. User Profile ────────────────────────────────────────────────────────

export type KYCStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type UserRole = 'customer' | 'agent' | 'admin' | 'super_admin';
export type IdentityDocumentType =
  | 'national_id'
  | 'passport'
  | 'drivers_license'
  | 'refugee_id'
  | 'voter_card';

export type SomaliRegion =
  | 'Banaadir'
  | 'Bay'
  | 'Bakool'
  | 'Bari'
  | 'Galgaduud'
  | 'Gedo'
  | 'Hiiraan'
  | 'Jubbada Dhexe'
  | 'Jubbada Hoose'
  | 'Mudug'
  | 'Nugaal'
  | 'Sanaag'
  | 'Shabeellaha Dhexe'
  | 'Shabeellaha Hoose'
  | 'Sool'
  | 'Togdheer'
  | 'Woqooyi Galbeed';

export interface SomaliAddress {
  city: string;
  region: SomaliRegion;
  district?: string;
  country: 'SO';
}

export interface IdentityDocument {
  type: IdentityDocumentType;
  number: string;
  expiresAt?: string;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  transactionAlerts: boolean;
  rateAlerts: boolean;
  marketing: boolean;
}

export interface UserPreferences {
  language: 'so' | 'en' | 'ar';
  theme: 'light' | 'dark' | 'system';
  defaultSendAmount?: number;
  notifications: NotificationPreferences;
}

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  identity?: IdentityDocument;
  address?: SomaliAddress;
  role: UserRole;
  kycStatus: KYCStatus;
  kycVerifiedAt?: string;
  wallets: Wallet[];
  preferredPlatform?: MobileMoneyPlatform;
  preferredCurrency: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}

// ─── § 8. Notifications ───────────────────────────────────────────────────────

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationCategory =
  | 'transaction'
  | 'exchange_rate'
  | 'security'
  | 'kyc'
  | 'system'
  | 'marketing';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  isRead: boolean;
  readAt?: string;
  isActionRequired: boolean;
  action?: { label: string; url: string };
  relatedEntity?: { type: 'transaction' | 'wallet' | 'kyc'; id: string };
  expiresAt?: string;
  createdAt: string;
}

// ─── § 9. Store & API Utilities ───────────────────────────────────────────────

export interface ApiError {
  code: string;
  field?: string;
  message: string;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  version: string;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ApiError[];
  meta?: ResponseMeta;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ExchangeParams {
  fromWalletId: string;
  toWalletId: string;
  fromAmount: number;
  description?: string;
}

export interface ExchangeResult {
  transaction: Transaction;
  receivedAmount: Money;
  fee: FeeBreakdown;
}

/** Typed error codes for the exchange pipeline — exhaustively handleable. */
export type OIMESErrorCode =
  | 'WALLET_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'RATE_NOT_AVAILABLE'
  | 'SAME_PLATFORM_EXCHANGE'
  | 'WALLET_SUSPENDED'
  | 'AMOUNT_BELOW_MINIMUM'
  | 'AMOUNT_ABOVE_MAXIMUM'
  | 'WALLET_ALREADY_LINKED'
  | 'WALLET_HAS_BALANCE'
  | 'LAST_WALLET'
  | 'INVALID_PHONE_NUMBER';
