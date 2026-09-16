// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Admin Activity Log — now backed by Supabase (admin_activity_log
// table, see supabase/007_activity_log_and_chat.sql), shared across every
// admin's browser/device instead of just localStorage on one machine.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabaseAdmin } from '../../lib/supabase';

export type ActivityAction = 'approve' | 'deny' | 'suspend' | 'activate' | 'adjust';

export interface ActivityLogEntry {
  id: string;
  adminUsername: string;
  action: ActivityAction;
  detail: string;
  createdAt: string;
}

interface ActivityLogRow {
  id: string;
  admin_username: string;
  action: ActivityAction;
  detail: string;
  created_at: string;
}

function mapRow(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: row.id,
    adminUsername: row.admin_username,
    action: row.action,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

export function useAdminActivityLog() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabaseAdmin
      .from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setEntries((data as ActivityLogRow[]).map(mapRow));
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabaseAdmin
      .channel('admin-activity-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_activity_log' }, () => refresh())
      .subscribe();
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [refresh]);

  const log = useCallback(async (adminUsername: string, action: ActivityAction, detail: string) => {
    const {
      data: { user },
    } = await supabaseAdmin.auth.getUser();
    await supabaseAdmin.from('admin_activity_log').insert({
      admin_id: user?.id ?? null,
      admin_username: adminUsername,
      action,
      detail,
    });
    // Realtime subscription above refreshes the list.
  }, []);

  return { entries, log };
}
