// ─────────────────────────────────────────────────────────────────────────────
// OIMES — RecentTransactions
// Dashboard preview of the last 3 transactions.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from 'motion/react';
import { Clock, ArrowRight, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { useOIMESStore, selectTransactions, PLATFORM_METADATA } from '../../store/index';
import { formatUSD } from '../../lib/utils';
import { STATUS_CONFIG } from '../../lib/constants';
import { CARD_VARIANTS } from './DashboardView';
import { PlatformDot } from '../../components/PlatformLogo';
import type { MobileMoneyPlatform, TransactionStatus } from '../../types';

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TransactionStatus }) {
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

// ─── RouteCell ────────────────────────────────────────────────────────────────

function RouteCell({ from, to }: { from: MobileMoneyPlatform; to: MobileMoneyPlatform }) {
  const fMeta = PLATFORM_METADATA[from];
  const tMeta = PLATFORM_METADATA[to];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        <PlatformDot platform={from} size={15} />
        <span style={{ fontSize: '12px', fontWeight: 500 }}>{fMeta.shortCode}</span>
      </div>
      <ArrowRight className="size-3 text-muted-foreground shrink-0" />
      <div className="flex items-center gap-1">
        <PlatformDot platform={to} size={15} />
        <span style={{ fontSize: '12px', fontWeight: 500 }}>{tMeta.shortCode}</span>
      </div>
    </div>
  );
}

// ─── RecentTransactions ───────────────────────────────────────────────────────

const TH_STYLE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'left',
};

export function RecentTransactions() {
  const all    = useOIMESStore(selectTransactions);
  const recent = all.slice(0, 3);

  return (
    <motion.div
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="visible"
      custom={0.27}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>Recent Transactions</span>
        </div>
        <button
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontSize: '12px' }}
        >
          View all
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
          <div className="flex items-center justify-center size-11 rounded-full bg-accent">
            <Clock className="size-5 text-muted-foreground" />
          </div>
          <div>
            <p style={{ fontSize: '13px' }} className="text-foreground">No transactions yet</p>
            <p style={{ fontSize: '12px' }} className="mt-1 text-muted-foreground">
              Your exchange history will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '640px' }}>
            <thead>
              <tr className="border-b border-border bg-accent/20">
                {['Reference', 'Route', 'Sent', 'Received', 'Fee', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 first:px-6" style={TH_STYLE}>
                    <span className="text-muted-foreground">{h}</span>
                  </th>
                ))}
                <th className="px-6 py-3" style={{ ...TH_STYLE, textAlign: 'right' }}>
                  <span className="text-muted-foreground">Date</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-border last:border-b-0 hover:bg-accent/20 transition-colors duration-100 cursor-default"
                >
                  <td className="px-6 py-4">
                    <span
                      className="text-muted-foreground"
                      style={{ fontSize: '11px', fontFamily: 'ui-monospace, "Cascadia Code", "SF Mono", monospace' }}
                    >
                      {tx.reference.split('-').slice(-2).join('-')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <RouteCell from={tx.fromWallet.platform} to={tx.toWallet.platform} />
                  </td>
                  <td className="px-4 py-4">
                    <span className="tabular-nums text-foreground" style={{ fontSize: '13px', fontWeight: 500 }}>
                      {formatUSD(tx.fromAmount.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--status-success-fg)' }}>
                      {formatUSD(tx.toAmount.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="tabular-nums text-muted-foreground" style={{ fontSize: '12px' }}>
                      {formatUSD(tx.fee.total.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-muted-foreground" style={{ fontSize: '12px' }}>
                      {format(new Date(tx.initiatedAt), 'dd MMM, HH:mm')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
