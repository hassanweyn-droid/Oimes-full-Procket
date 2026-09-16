// ─────────────────────────────────────────────────────────────────────────────
// OIMES — maps a raw `public.users` row (snake_case, from Supabase) to the
// UserProfile shape the rest of the app expects (camelCase). Shared by the
// customer auth store and the admin dashboard's live users hook so both stay
// in sync with exactly one definition of "what a DB row looks like."
// ─────────────────────────────────────────────────────────────────────────────

import type { UserProfile, SomaliRegion } from '../types';

export interface UsersRow {
  id: string;
  email: string;
  phone: string | null;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  region: string | null;
  role: 'customer' | 'admin' | 'super_admin';
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  is_active: boolean;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  created_at: string;
  updated_at: string;
}

export function mapRowToProfile(row: UsersRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone ?? undefined,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    address: row.city
      ? { city: row.city, region: (row.region ?? 'Banaadir') as SomaliRegion, country: 'SO' as const }
      : undefined,
    role: row.role,
    kycStatus: row.kyc_status,
    wallets: [],
    preferredCurrency: 'USD',
    isActive: row.is_active,
    isEmailVerified: row.is_email_verified,
    isPhoneVerified: row.is_phone_verified,
    twoFactorEnabled: false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    preferences: {
      language: 'en',
      theme: 'system',
      notifications: {
        email: true,
        sms: true,
        push: true,
        transactionAlerts: true,
        rateAlerts: false,
        marketing: false,
      },
    },
  };
}
