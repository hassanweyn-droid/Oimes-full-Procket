// ─────────────────────────────────────────────────────────────────────────────
// OIMES — Customer-side support chat hook
// Replaces the old localStorage support-store.ts. Fetches this customer's
// conversation with support and stays live via realtime — an admin's reply
// (sent from the admin portal, possibly a different device entirely) shows
// up here without a refresh.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { mapSupportMessageRow, type SupportMessage, type SupportMessageRow } from '../../lib/map-support-message';

export type { SupportMessage };

export function useSupportChat(userId: string | undefined) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (!error && data) setMessages((data as SupportMessageRow[]).map(mapSupportMessageRow));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const channel = supabase
      .channel(`support-chat-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const sendUserMessage = useCallback(
    async (text: string) => {
      if (!userId) return;
      await supabase.from('support_messages').insert({ user_id: userId, sender: 'user', message: text });
    },
    [userId]
  );

  return { messages, sendUserMessage };
}
