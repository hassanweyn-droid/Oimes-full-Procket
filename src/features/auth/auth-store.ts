// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Auth Store (Zustand) — now backed by real Supabase Auth
// Signup/login/logout go through supabase.auth. The public.users row is
// created automatically by a database trigger (see
// supabase/002_auto_profile_trigger.sql) the moment a new auth.users record
// exists, so we never insert the profile row from the client.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import type { UserProfile } from '../../types';
import { supabase } from '../../lib/supabase';
import { mapRowToProfile, type UsersRow } from '../../lib/map-user-row';

// ─── Error codes ──────────────────────────────────────────────────────────────

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL'
  | 'REQUIRED_FIELD'
  | 'WRONG_CURRENT_PASSWORD'
  | 'ACCOUNT_SUSPENDED'
  | 'NETWORK_ERROR';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── DB row → UserProfile mapping ──────────────────────────────────────────────
// Only the columns that actually exist in supabase/schema.sql are read from
// the database. Fields the schema doesn't persist yet (preferences, identity,
// address, 2FA) default sensibly on the client — see the README note in
// supabase/schema.sql if you want to extend the table for these.

async function fetchProfile(userId: string): Promise<UserProfile> {
  // The auto-create trigger runs asynchronously with signUp — retry briefly
  // in case the row isn't visible on the very first read yet.
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) throw new AuthError('NETWORK_ERROR', error.message);
    if (data) return mapRowToProfile(data as UsersRow);
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new AuthError('NETWORK_ERROR', 'Your account was created, but the profile is still syncing. Please try logging in again in a few seconds.');
}

// Used right after signUp only. If the database trigger that's supposed to
// auto-create the profile row hasn't fired yet (or isn't configured), this
// creates it directly from the client instead of leaving the person stuck —
// see supabase/013_profile_insert_fallback.sql for the RLS policy that makes
// this insert allowed.
async function fetchOrCreateProfile(
  userId: string,
  fallback: { email: string; firstName: string; lastName: string; displayName: string; phone: string; city: string; region: string }
): Promise<UserProfile> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) throw new AuthError('NETWORK_ERROR', error.message);
    if (data) return mapRowToProfile(data as UsersRow);
    await new Promise((r) => setTimeout(r, 400));
  }

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({
      id: userId,
      email: fallback.email,
      phone: fallback.phone,
      first_name: fallback.firstName,
      last_name: fallback.lastName,
      display_name: fallback.displayName,
      city: fallback.city,
      region: fallback.region,
      role: 'customer',
      kyc_status: 'unverified',
      is_active: true,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw new AuthError(
      'NETWORK_ERROR',
      'Your account was created, but the profile is still syncing. Please try logging in again in a few seconds.'
    );
  }
  return mapRowToProfile(inserted as UsersRow);
}

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: UserProfile | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    phone: string,
    city: string,
    region: string
  ) => Promise<void>;
  logout: () => void;
  changePassword: (currentPw: string, newPw: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  /** Optimistic local patch of the signed-in profile — used after an action
   *  that changed a field server-side (e.g. submitting KYC for review) so
   *  the UI doesn't need a full re-fetch to reflect it. */
  updateCurrentUserFields: (fields: Partial<UserProfile>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      immer((_set, _get) => ({
        isAuthenticated: false,
        currentUser: null,

        // ── login ──────────────────────────────────────────────────────────────
        login: async (email: string, password: string) => {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email.toLowerCase().trim(),
            password,
          });
          if (error) {
            throw new AuthError('INVALID_CREDENTIALS', 'Incorrect email or password. Please try again.');
          }
          if (!data.user) throw new AuthError('INVALID_CREDENTIALS', 'Login failed. Please try again.');

          const profile = await fetchProfile(data.user.id);
          profile.isEmailVerified = data.user.email_confirmed_at != null;
          if (!profile.isActive) {
            await supabase.auth.signOut();
            throw new AuthError('ACCOUNT_SUSPENDED', 'This account has been suspended. Contact support for help.');
          }
          _set((draft) => {
            draft.isAuthenticated = true;
            draft.currentUser = profile;
          });
        },

        // ── signup ─────────────────────────────────────────────────────────────
        signup: async (firstName, lastName, email, password, phone, city, region) => {
          const normalizedEmail = email.toLowerCase().trim();
          const { data, error } = await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                display_name: `${firstName.trim()} ${lastName.trim()}`,
                phone,
                city: city.trim(),
                region,
                role: 'customer',
              },
            },
          });

          if (error) {
            if (error.message.toLowerCase().includes('already registered')) {
              throw new AuthError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists. Try logging in instead.');
            }
            if (error.message.toLowerCase().includes('password')) {
              throw new AuthError('WEAK_PASSWORD', error.message);
            }
            throw new AuthError('NETWORK_ERROR', error.message);
          }
          if (!data.user) throw new AuthError('NETWORK_ERROR', 'Signup did not return a user. Please try again.');

          // If your Supabase project has "Confirm email" turned on, there is no
          // active session yet — the person must verify their email before they
          // can log in. Surface that clearly instead of silently failing.
          if (!data.session) {
            throw new AuthError(
              'NETWORK_ERROR',
              'Account created! Check your email to confirm your address before logging in.'
            );
          }

          const profile = await fetchOrCreateProfile(data.user.id, {
            email: normalizedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            displayName: `${firstName.trim()} ${lastName.trim()}`,
            phone,
            city: city.trim(),
            region,
          });
          profile.isEmailVerified = data.user.email_confirmed_at != null;
          _set((draft) => {
            draft.isAuthenticated = true;
            draft.currentUser = profile;
          });
        },

        // ── logout ─────────────────────────────────────────────────────────────
        logout: () => {
          supabase.auth.signOut();
          _set((draft) => {
            draft.isAuthenticated = false;
            draft.currentUser = null;
          });
        },

        // ── changePassword ────────────────────────────────────────────────────
        changePassword: async (currentPw: string, newPw: string) => {
          const state = _get();
          if (!state.currentUser) throw new AuthError('INVALID_CREDENTIALS', 'Not logged in.');

          // Supabase requires re-authentication before a sensitive update like
          // this in most configurations; verify the current password first.
          const { error: verifyError } = await supabase.auth.signInWithPassword({
            email: state.currentUser.email,
            password: currentPw,
          });
          if (verifyError) throw new AuthError('WRONG_CURRENT_PASSWORD', 'Current password is incorrect.');

          const { error } = await supabase.auth.updateUser({ password: newPw });
          if (error) throw new AuthError('WEAK_PASSWORD', error.message);
        },

        // ── restoreSession ─────────────────────────────────────────────────────
        // Call once on app load so a refresh doesn't lose the Supabase session
        // even though `persist` already remembers isAuthenticated/currentUser.
        updateCurrentUserFields: (fields) => {
          _set((draft) => {
            if (draft.currentUser) {
              Object.assign(draft.currentUser, fields);
            }
          });
        },

        restoreSession: async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            _set((draft) => {
              draft.isAuthenticated = false;
              draft.currentUser = null;
            });
            return;
          }
          try {
            const profile = await fetchProfile(data.session.user.id);
            profile.isEmailVerified = data.session.user.email_confirmed_at != null;
            _set((draft) => {
              draft.isAuthenticated = true;
              draft.currentUser = profile;
            });
          } catch {
            // Profile fetch failed (e.g. offline) — keep whatever persisted
            // state we already had rather than forcing a logout.
          }
        },
      })),
      {
        name: 'oimes-auth',
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
          currentUser: state.currentUser,
        }),
      }
    ),
    { name: 'OIMES-Auth' }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectIsAuthenticated = (s: AuthState) => s.isAuthenticated;
export const selectCurrentUser = (s: AuthState) => s.currentUser;
