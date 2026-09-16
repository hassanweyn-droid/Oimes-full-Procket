# Plan: OIMES `src/types.ts` — Complete TypeScript Type Definitions

## Context

OIMES is a mobile money exchange system targeting Somalia's four major platforms: **EVC Plus** (Hormuud Telecom), **Sahal** (Somtel), **Zaad** (Telesom), and **eDahab** (Dahabshiil). This is Step 1 of the system design — establishing the shared type contract that every component, service, and API layer will depend on. Getting this right now prevents cascading type changes later.

The project runs React 18.3.1 + TypeScript (via Vite's plugin, no tsconfig.json). Types must be idiomatic TypeScript 5.x: discriminated unions, branded types, const arrays for exhaustive checks, and `readonly` where immutability is meaningful.

---

## File to Create

**`/workspaces/default/code/src/types.ts`** — single source of truth for all domain types.

---

## Type Architecture

### 1. `MobileMoneyPlatform` — platform identity

```ts
export const MOBILE_MONEY_PLATFORMS = ['evc_plus', 'sahal', 'zaad', 'edahab'] as const;
export type MobileMoneyPlatform = typeof MOBILE_MONEY_PLATFORMS[number];
```

Using `as const` array makes exhaustiveness checking trivial (`MOBILE_MONEY_PLATFORMS.includes(x)`). String literals over enums for JSON/serialization safety.

---

### 2. `PlatformMetadata` — static config per platform

Fields:
- `id: MobileMoneyPlatform`
- `displayName` / `shortCode` / `operator` (e.g. "Hormuud Telecom")
- `primaryCurrency: Currency['code']` — each platform anchors to USD or SOS
- `supportedCurrencies: ReadonlyArray<Currency['code']>`
- `brandColor: string` — hex, for UI theming
- `logoUrl?: string`
- `ussdCode?: string`
- `transferLimits: { min: number; max: number; dailyMax: number }`
- `fee: PlatformFee` — discriminated union: `{ type: 'percentage'; rate: number; cap?: number } | { type: 'fixed'; amount: number } | { type: 'tiered'; tiers: FeeTier[] }`
- `isActive: boolean`
- `supportedRegions: readonly string[]`

---

### 3. `Currency` — value type for money

```ts
export interface Currency {
  code: string;        // 'USD' | 'SOS'
  symbol: string;      // '$' | 'Sh'
  name: string;
  decimals: number;
}
```

Also: `Money` branded type — `{ amount: number; currency: Currency['code'] }` — to prevent raw `number` arithmetic across currencies.

---

### 4. `Wallet` — user's account on a platform

Discriminated by `status`:
- `status: WalletStatus` — `'active' | 'suspended' | 'closed' | 'pending_verification'`

Fields:
- `id`, `userId` — UUID strings
- `platform: MobileMoneyPlatform`
- `phoneNumber: string` — E.164 format (`+252...`)
- `displayName?: string` — user-assigned label
- `balance: Money`
- `isDefault: boolean` — primary send wallet
- `isVerified: boolean`
- `lastSyncedAt: string` — ISO 8601
- `createdAt / updatedAt: string`

---

### 5. `Transaction` — exchange/transfer record

Discriminated by `type`:
- `'exchange'` — cross-platform swap (main use case)
- `'deposit'` — top-up into a wallet
- `'withdrawal'` — cash out
- `'transfer'` — same-platform peer send

Discriminated by `status`:
- `'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'reversed'`

Key fields:
- `id`, `userId`
- `fromWallet`, `toWallet` — embedded `WalletSnapshot` (denormalized, point-in-time)
- `fromAmount: Money`, `toAmount: Money` — amounts in respective currencies
- `exchangeRate?: ExchangeRate` — snapshot at time of transaction
- `fee: FeeBreakdown` — `{ platformFee: Money; serviceFee: Money; total: Money }`
- `reference: string` — internal ref
- `externalReference?: string` — platform-side ref (e.g. EVC transaction ID)
- `description?: string`
- `initiatedAt / completedAt? / failedAt?: string`
- `failureReason?: string`

`WalletSnapshot`: `{ walletId: string; platform: MobileMoneyPlatform; phoneNumber: string; displayName?: string }` — denormalized so historical transactions remain accurate after wallet changes.

---

### 6. `ExchangeRate` — live rate between two platforms

```ts
export interface ExchangeRate {
  id: string;
  fromPlatform: MobileMoneyPlatform;
  toPlatform: MobileMoneyPlatform;
  rate: number;              // toAmount = fromAmount * rate
  inverseRate: number;       // pre-computed for UI
  spread: number;            // margin percentage
  fetchedAt: string;         // ISO 8601
  expiresAt: string;
  source: 'live' | 'cached' | 'manual';
}
```

---

### 7. `UserProfile` — account and KYC data

Discriminated by `kycStatus: KYCStatus`:
- `'unverified' | 'pending' | 'verified' | 'rejected'`

Fields:
- `id`, `email`, `phone?: string`
- `firstName`, `lastName`, `displayName`
- `avatarUrl?: string`
- `dateOfBirth?: string`
- `identity?: IdentityDocument` — `{ type: IdentityDocumentType; number: string; expiresAt?: string }`
- `address?: SomaliAddress` — `{ city: string; region: SomaliRegion; district?: string; country: 'SO' }`
- `role: UserRole` — `'customer' | 'agent' | 'admin' | 'super_admin'`
- `wallets: Wallet[]`
- `preferredPlatform?: MobileMoneyPlatform`
- `preferredCurrency: Currency['code']`
- `isActive`, `isEmailVerified`, `isPhoneVerified`
- `twoFactorEnabled: boolean`
- `lastLoginAt?: string`
- `createdAt / updatedAt: string`
- `preferences: UserPreferences`

`UserPreferences`:
- `language: 'so' | 'en' | 'ar'`
- `theme: 'light' | 'dark' | 'system'`
- `defaultSendAmount?: number`
- `notifications: NotificationPreferences`

`NotificationPreferences`: `{ email, sms, push, transactionAlerts, rateAlerts, marketing }` — all boolean.

---

### 8. `Notification` — in-app alert

Discriminated by `type: NotificationType` (`'info' | 'success' | 'warning' | 'error'`)
and `category: NotificationCategory` (`'transaction' | 'exchange_rate' | 'security' | 'kyc' | 'system' | 'marketing'`).

Fields:
- `id`, `userId`
- `title`, `message`
- `isRead: boolean`, `readAt?: string`
- `isActionRequired: boolean`
- `action?: { label: string; url: string }` — grouped as optional object
- `relatedEntity?: { type: 'transaction' | 'wallet' | 'kyc'; id: string }`
- `expiresAt?: string`
- `createdAt: string`

---

### 9. Utility / API types

```ts
// Generic API envelope
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: ApiError[];
  meta?: ResponseMeta;
}

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

// Pagination
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
```

---

### 10. Supporting enums / literals

```ts
export type SomaliRegion = 
  | 'Banaadir' | 'Bay' | 'Bakool' | 'Bari' | 'Galgaduud' 
  | 'Gedo' | 'Hiiraan' | 'Jubbada Dhexe' | 'Jubbada Hoose' 
  | 'Mudug' | 'Nugaal' | 'Sanaag' | 'Shabeellaha Dhexe' 
  | 'Shabeellaha Hoose' | 'Sool' | 'Togdheer' | 'Woqooyi Galbeed';

export type IdentityDocumentType = 
  | 'national_id' | 'passport' | 'drivers_license' | 'refugee_id' | 'voter_card';
```

---

## File Structure

All types in a single `src/types.ts`, organized in sections with comment headers:
1. Primitives & Enums
2. Currency & Money
3. Platform
4. Wallet
5. Transaction
6. Exchange Rate
7. User & Auth
8. Notifications
9. API Utilities

---

## Verification

After implementation:
- TypeScript type-checks automatically via Vite's dev server (no separate tsc step needed)
- Confirm no red squiggles in App.tsx when importing and using types
- Key check: `MobileMoneyPlatform` is exhaustively narrowable via `MOBILE_MONEY_PLATFORMS` array
- Key check: `Transaction` status transitions are clear via discriminated status field
- Key check: `Money` type prevents mixing `amount: number` with raw numbers
