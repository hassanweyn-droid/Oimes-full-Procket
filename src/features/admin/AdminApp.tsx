// ─────────────────────────────────────────────────────────────────────────────
// OIMES — AdminApp
// Mirrors the shape of app/App.tsx: gates on admin auth (a completely separate
// store from the customer auth-store), showing login or the dashboard.
//
// There is deliberately no self-service admin signup here. Admin accounts
// are provisioned out-of-band (promote an existing account's role to
// 'admin'/'super_admin' directly in Supabase — see the note in
// supabase/016_lock_down_admin_role.sql) so this portal can never be used
// to mint a new admin from the outside, even by someone with the public
// anon key. The database enforces this independently of this UI — see
// that same migration — so removing this page is belt-and-braces, not the
// only line of defense.
// ─────────────────────────────────────────────────────────────────────────────

import { AnimatePresence, motion } from 'motion/react';
import { useAdminAuthStore, selectIsAdminAuthenticated } from './admin-store';
import { AdminLoginView } from './AdminLoginView';
import { AdminDashboardView } from './AdminDashboardView';

export default function AdminApp() {
  const isAdminAuthenticated = useAdminAuthStore(selectIsAdminAuthenticated);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isAdminAuthenticated ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AdminLoginView />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AdminDashboardView />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
