// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Admin-side support chat
// Two capabilities: a global feed of every customer's messages (for the
// unread-count badges in the users table), and a per-conversation view used
// by the chat modal. Both use supabaseAdmin — the admin's own session — so
// RLS's support_messages_admin_all policy (is_admin()) applies correctly.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabaseAdmin } from '../../lib/supabase';
import { mapSupportMessageRow, type SupportMessage, type SupportMessageRow } from '../../lib/map-support-message';

export type { SupportMessage };

/** All support messages across all customers — used for unread badges. */
export function useAllSupportMessages() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabaseAdmin
      .from('support_messages')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data) setMessages((data as SupportMessageRow[]).map(mapSupportMessageRow));
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabaseAdmin
      .channel('admin-support-chat-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => refresh())
      .subscribe();
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [refresh]);

  const sendAdminReply = useCallback(async (userId: string, text: string, adminName: string) => {
    await supabaseAdmin.from('support_messages').insert({
      user_id: userId,
      sender: 'admin',
      sender_name: adminName,
      message: text,
    });
  }, []);

  return { messages, sendAdminReply };
}
