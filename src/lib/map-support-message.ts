// ─────────────────────────────────────────────────────────────────────────────
// OIMES — shared support_messages row ⇄ SupportMessage mapping, used by both
// the customer-side and admin-side chat hooks so there's one definition.
// ─────────────────────────────────────────────────────────────────────────────

export interface SupportMessage {
  id: string;
  userId: string;
  from: 'user' | 'admin';
  senderName?: string;
  text: string;
  createdAt: string;
}

export interface SupportMessageRow {
  id: string;
  user_id: string;
  sender: 'user' | 'admin';
  sender_name: string | null;
  message: string;
  created_at: string;
}

export function mapSupportMessageRow(row: SupportMessageRow): SupportMessage {
  return {
    id: row.id,
    userId: row.user_id,
    from: row.sender,
    senderName: row.sender_name ?? undefined,
    text: row.message,
    createdAt: row.created_at,
  };
}
