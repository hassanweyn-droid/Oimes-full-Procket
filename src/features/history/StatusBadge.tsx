// ─────────────────────────────────────────────────────────────────────────────
// OIMES — StatusBadge
// Transaction status badge — shared between HistoryView and RecentTransactions.
// ─────────────────────────────────────────────────────────────────────────────

import { STATUS_CONFIG } from '../../lib/constants';
import type { TransactionStatus } from '../../types';

interface StatusBadgeProps {
  status: TransactionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      style={{
        backgroundColor: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {c.label}
    </span>
  );
}
