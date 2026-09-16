// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Admin Auth Store — backed by real Supabase Auth
// Admins and customers share the same auth.users pool and the same `users`
// table (this matches Chapter 3's single-table design — role is just a
// column). Logging in here still checks that the account's role is
// 'admin' or 'super_admin'; anything else is rejected even with a correct
// password, so a customer account can never reach the admin portal.
//
// Deliberately no `signup` here. Admin accounts are provisioned by hand —
// promote an existing row's `role` to 'admin'/'super_admin' directly in
// Supabase (see supabase/016_lock_down_admin_role.sql) — never through the
// app. That migration also makes `role` impossible to set to anything but
// 'customer' from a normal end-user session at the database level, so this
// isn't just a UI restriction: removing this function only closes the
// front door, the migration closes the ones that don't need a door at all.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { supabaseAdmin } from '../../lib/supabase';
import { type UsersRow } from '../../lib/map-user-row';

export interface AdminProfile {
  id: string;
  username: string; // maps to display_name in the users table
  email: string;
  role: 'admin' | 'super_admin';
  createdAt: string;
}

export type AdminErrorCode = 'INVALID_CREDENTIALS' | 'NOT_AN_ADMIN_ACCOUNT' | 'NETWORK_ERROR';

export class AdminAuthError extends Error {
  code: AdminErrorCode;
  constructor(code: AdminErrorCode, message: string) {
    super(message);
    this.name = 'AdminAuthError';
    this.code = code;
  }
}

async function fetchAdminProfile(userId: string): Promise<AdminProfile> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) throw new AdminAuthError('NETWORK_ERROR', error.message);
    if (data) {
      const row = data as UsersRow;
      return { id: row.id, username: row.display_name, email: row.email, role: row.role as 'admin' | 'super_admin', createdAt: row.created_at };
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new AdminAuthError('NETWORK_ERROR', 'Your account was created, but the profile is still syncing. Please try again in a moment.');
}

interface AdminAuthState {
  isAdminAuthenticated: boolean;
  currentAdmin: AdminProfile | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => Promise<void>;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  devtools(
    persist(
      immer((set) => ({
        isAdminAuthenticated: false,
        currentAdmin: null,

        login: async (email, password) => {
          const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
          if (error) throw new AdminAuthError('INVALID_CREDENTIALS', 'Incorrect email or password.');
          if (!data.user) throw new AdminAuthError('INVALID_CREDENTIALS', 'Login failed. Please try again.');

          const profile = await fetchAdminProfile(data.user.id);
          if (profile.role !== 'admin' && profile.role !== 'super_admin') {
            await supabaseAdmin.auth.signOut();
            throw new AdminAuthError('NOT_AN_ADMIN_ACCOUNT', 'This account does not have admin access.');
          }
          set((d) => {
            d.isAdminAuthenticated = true;
            d.currentAdmin = profile;
          });
        },

        logout: () => {
          supabaseAdmin.auth.signOut();
          set((d) => {
            d.isAdminAuthenticated = false;
            d.currentAdmin = null;
          });
        },

        restoreSession: async () => {
          const { data } = await supabaseAdmin.auth.getSession();
          if (!data.session) return;
          try {
            const profile = await fetchAdminProfile(data.session.user.id);
            if (profile.role === 'admin' || profile.role === 'super_admin') {
              set((d) => {
                d.isAdminAuthenticated = true;
                d.currentAdmin = profile;
              });
            }
          } catch {
            // offline or profile not ready yet — leave persisted state as-is
          }
        },
      })),
      {
        name: 'oimes-admin-auth',
        partialize: (s) => ({ isAdminAuthenticated: s.isAdminAuthenticated, currentAdmin: s.currentAdmin }),
      }
    ),
    { name: 'OIMES-Admin-Auth' }
  )
);

export const selectIsAdminAuthenticated = (s: AdminAuthState) => s.isAdminAuthenticated;
export const selectCurrentAdmin = (s: AdminAuthState) => s.currentAdmin;
