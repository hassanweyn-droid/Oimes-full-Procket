// ─────────────────────────────────────────────────────────────────────────────
// OIMES — useSupabaseUsers
// Replaces the old localStorage-backed users-store for the admin dashboard.
// Fetches every row in `users` (RLS's admin_full_access_users policy allows
// this only for accounts with role admin/super_admin) and stays live via a
// Postgres changes subscription — so a new signup or a suspend/activate
// toggle (from any tab, any admin) shows up immediately without a refresh.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabaseAdmin } from '../../lib/supabase';
import { mapRowToProfile, type UsersRow } from '../../lib/map-user-row';
import type { UserProfile } from '../../types';

export function useSupabaseUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setError('');
      setUsers((data as UsersRow[]).map(mapRowToProfile));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabaseAdmin
      .channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => refresh())
      .subscribe();
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [refresh]);

  const setActive = useCallback(async (userId: string, isActive: boolean): Promise<void> => {
    const { error: updateError } = await supabaseAdmin.from('users').update({ is_active: isActive }).eq('id', userId);
    if (updateError) throw new Error(updateError.message);
    // No manual refresh needed — the realtime subscription above will pick up this change.
  }, []);

  return { users, loading, error, setActive, refresh };
}
